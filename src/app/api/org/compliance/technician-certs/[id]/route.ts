import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/roles'
import { UserRole } from '@/types/enums'

/**
 * GET /api/org/compliance/technician-certs/:id
 * Returns a single certification with user join.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('technician_certifications')
    .select('*, user:users(id, first_name, last_name, email, role)')
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/**
 * PATCH /api/org/compliance/technician-certs/:id
 * Manager+ only. Updates allowed fields.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccess(dbUser.role, UserRole.MANAGER)) {
    return NextResponse.json({ error: 'Manager role required' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const allowed = [
    'cert_body', 'cert_type', 'credential_id', 'state',
    'issue_date', 'expiration_date', 'cpd_required',
    'cpd_hours_completed', 'cpd_hours_required',
    'document_url', 'status', 'notes',
  ]
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of allowed) if (body[k] !== undefined) update[k] = body[k]
  if (typeof update.state === 'string') update.state = (update.state as string).toUpperCase()

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('technician_certifications')
    .update(update)
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .select('*, user:users(id, first_name, last_name, email, role)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/**
 * DELETE /api/org/compliance/technician-certs/:id
 * Manager+ only.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccess(dbUser.role, UserRole.MANAGER)) {
    return NextResponse.json({ error: 'Manager role required' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('technician_certifications')
    .delete()
    .eq('id', id)
    .eq('org_id', dbUser.org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
