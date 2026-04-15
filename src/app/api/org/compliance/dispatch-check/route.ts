import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/org/compliance/dispatch-check?user_id=...&state=XX
 * Returns { eligible, warnings[], blockers[] } for dispatching a tech to a state.
 *
 * Soft-warn pattern: never hard-blocks at the API level. Callers decide whether
 * warnings or blockers should be enforced (e.g. DispatchView shows them as badges).
 */
export async function GET(req: NextRequest) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = req.nextUrl.searchParams.get('user_id')
  const stateRaw = req.nextUrl.searchParams.get('state')
  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })
  if (!stateRaw) return NextResponse.json({ error: 'state required' }, { status: 400 })

  const state = stateRaw.toUpperCase()
  const warnings: string[] = []
  const blockers: string[] = []

  const admin = createAdminClient()

  // Verify tech is in same org
  const { data: tech } = await admin
    .from('users')
    .select('id, org_id, first_name, last_name')
    .eq('id', userId)
    .single()
  if (!tech || tech.org_id !== dbUser.org_id) {
    return NextResponse.json({ error: 'Technician not in your organization' }, { status: 403 })
  }

  // Look up state licensing requirements
  const { data: stateRefs } = await admin
    .from('state_licensing_reference')
    .select('*')
    .eq('state', state)

  if (!stateRefs || stateRefs.length === 0) {
    warnings.push(`No state licensing reference data on file for ${state}. Verify with AHJ.`)
    return NextResponse.json({ eligible: true, warnings, blockers, state, user_id: userId })
  }

  // If any ref row says NO_STATE_LICENSE, the state has no requirement at all
  const noStateLicense = stateRefs.every(r => r.status === 'NO_STATE_LICENSE')
  if (noStateLicense) {
    return NextResponse.json({ eligible: true, warnings, blockers, state, user_id: userId })
  }

  // Fetch tech's active licenses in this state
  const today = new Date().toISOString().slice(0, 10)
  const { data: techLicenses } = await admin
    .from('technician_licenses')
    .select('*')
    .eq('org_id', dbUser.org_id)
    .eq('user_id', userId)
    .eq('state', state)
    .eq('status', 'active')

  const activeLicenses = (techLicenses ?? []).filter(l => {
    if (!l.expiration_date) return true
    return l.expiration_date >= today
  })

  const requiredRefs = stateRefs.filter(r => r.status === 'LICENSE_REQUIRED')
  const electricianRefs = stateRefs.filter(r => r.status === 'ELECTRICIAN_LICENSE')

  if (requiredRefs.length > 0 && activeLicenses.length === 0) {
    const types = requiredRefs.map(r => r.license_type).join(', ')
    blockers.push(`${state} requires a state license (${types}). Tech has no active license on file.`)
  }

  if (electricianRefs.length > 0 && activeLicenses.length === 0) {
    const types = electricianRefs.map(r => r.license_type).join(', ')
    warnings.push(`${state} recognizes electrician licensing (${types}). Tech has no active license on file.`)
  }

  // Expiry soon warnings (active but <= 30 days out)
  for (const lic of activeLicenses) {
    if (!lic.expiration_date) continue
    const exp = new Date(lic.expiration_date).getTime()
    const now = Date.now()
    const daysLeft = Math.floor((exp - now) / (1000 * 60 * 60 * 24))
    if (daysLeft <= 30) {
      warnings.push(`${lic.license_type} (${lic.license_number ?? 'no #'}) expires in ${daysLeft} days.`)
    }
  }

  const eligible = blockers.length === 0
  return NextResponse.json({
    eligible,
    warnings,
    blockers,
    state,
    user_id: userId,
    active_licenses: activeLicenses.length,
    state_refs: stateRefs.length,
  })
}
