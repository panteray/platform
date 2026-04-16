import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { dbError } from '@/lib/api-utils'

/**
 * GET /api/org/compliance/state-licensing
 * List all org_state_licensing rows for the user's org.
 * Optional filters: ?state=LA, ?license_required=true
 */
export async function GET(req: NextRequest) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const state = req.nextUrl.searchParams.get('state')
  const licenseRequired = req.nextUrl.searchParams.get('license_required')

  const admin = createAdminClient()
  let query = admin
    .from('org_state_licensing')
    .select('*')
    .eq('org_id', dbUser.org_id)
    .order('state', { ascending: true })

  if (state) query = query.eq('state', state.toUpperCase())
  if (licenseRequired === 'true') query = query.eq('license_required', true)
  if (licenseRequired === 'false') query = query.eq('license_required', false)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: dbError(error) }, { status: 500 })
  return NextResponse.json(data ?? [])
}

/**
 * PATCH /api/org/compliance/state-licensing
 * Update a single org_state_licensing row.
 * Body: { id, license_required?, license_type?, requirements_summary?, agency_name?, agency_url?, notes? }
 */
export async function PATCH(req: NextRequest) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only managers+ can edit licensing reference
  const editRoles = ['ORG_ADMIN', 'ORG_MANAGER', 'MANAGER', 'GLOBAL_ADMIN']
  if (!editRoles.includes(dbUser.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body = await req.json()
  const { id, ...updates } = body

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  // Only allow known fields
  const allowed = ['license_required', 'license_type', 'requirements_summary', 'agency_name', 'agency_url', 'notes', 'last_verified_at']
  const filtered: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in updates) filtered[key] = updates[key]
  }

  if (Object.keys(filtered).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('org_state_licensing')
    .update(filtered)
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: dbError(error) }, { status: 500 })
  return NextResponse.json(data)
}
