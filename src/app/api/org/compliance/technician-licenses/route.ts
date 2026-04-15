import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/roles'
import { UserRole } from '@/types/enums'

/**
 * GET /api/org/compliance/technician-licenses
 * Optional filters: ?user_id=, ?state=, ?status=
 * Returns joined with user info.
 */
export async function GET(req: NextRequest) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = req.nextUrl.searchParams.get('user_id')
  const state = req.nextUrl.searchParams.get('state')
  const status = req.nextUrl.searchParams.get('status')

  const admin = createAdminClient()
  let query = admin
    .from('technician_licenses')
    .select('*, user:users(id, first_name, last_name, email, role)')
    .eq('org_id', dbUser.org_id)
    .order('expiration_date', { ascending: true, nullsFirst: false })

  if (userId) query = query.eq('user_id', userId)
  if (state) query = query.eq('state', state.toUpperCase())
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

/**
 * POST /api/org/compliance/technician-licenses
 * Manager+ only. Adds a license record for a tech in this org.
 */
export async function POST(req: NextRequest) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccess(dbUser.role, UserRole.MANAGER)) {
    return NextResponse.json({ error: 'Manager role required' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })
  if (!body.license_type) return NextResponse.json({ error: 'license_type required' }, { status: 400 })
  if (!body.state) return NextResponse.json({ error: 'state required' }, { status: 400 })

  const admin = createAdminClient()

  // Verify target user is in same org
  const { data: targetUser } = await admin
    .from('users')
    .select('id, org_id')
    .eq('id', body.user_id)
    .single()
  if (!targetUser || targetUser.org_id !== dbUser.org_id) {
    return NextResponse.json({ error: 'Target user not in your organization' }, { status: 403 })
  }

  const { data, error } = await admin
    .from('technician_licenses')
    .insert({
      org_id: dbUser.org_id,
      user_id: body.user_id,
      license_type: body.license_type,
      license_number: body.license_number ?? null,
      state: (body.state as string).toUpperCase(),
      issued_date: body.issued_date ?? null,
      expiration_date: body.expiration_date ?? null,
      document_url: body.document_url ?? null,
      status: body.status ?? 'active',
      notes: body.notes ?? null,
      created_by: dbUser.id,
    })
    .select('*, user:users(id, first_name, last_name, email, role)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
