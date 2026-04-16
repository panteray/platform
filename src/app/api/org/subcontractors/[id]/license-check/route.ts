import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/org/subcontractors/:id/license-check
 * Checks license compliance for a subcontractor across their operating states.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Get the subcontractor's operating states
  const { data: sub, error: subError } = await admin
    .from('subcontractors')
    .select('id, operating_states')
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .single()

  if (subError || !sub) {
    return NextResponse.json({ error: 'Subcontractor not found' }, { status: 404 })
  }

  const operatingStates: string[] = sub.operating_states ?? []
  if (!operatingStates.length) {
    return NextResponse.json({
      sub_id: id,
      compliant: true,
      states: [],
    })
  }

  const now = new Date().toISOString()
  const states: {
    state: string
    license_required: boolean
    required_license_type: string | null
    has_license: boolean
    license_doc_id?: string
    license_expires?: string
  }[] = []

  let compliant = true

  for (const st of operatingStates) {
    // Check state licensing requirements
    const { data: stateReq } = await admin
      .from('org_state_licensing')
      .select('license_required, license_type')
      .eq('state', st)
      .eq('org_id', dbUser.org_id)
      .single()

    const licenseRequired = stateReq?.license_required ?? false
    const requiredType = stateReq?.license_type ?? null

    // Check if sub has a license doc for this state
    const { data: licenseDoc } = await admin
      .from('sub_documents')
      .select('id, expiration_date')
      .eq('sub_id', id)
      .eq('doc_type', 'license')
      .eq('state', st)
      .gte('expiration_date', now)
      .limit(1)
      .maybeSingle()

    const hasLicense = !!licenseDoc

    if (licenseRequired && !hasLicense) {
      compliant = false
    }

    states.push({
      state: st,
      license_required: licenseRequired,
      required_license_type: requiredType,
      has_license: hasLicense,
      ...(licenseDoc?.id && { license_doc_id: licenseDoc.id }),
      ...(licenseDoc?.expiration_date && { license_expires: licenseDoc.expiration_date }),
    })
  }

  return NextResponse.json({ sub_id: id, compliant, states })
}
