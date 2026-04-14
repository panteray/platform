import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/roles'
import { UserRole } from '@/types/enums'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('psa_kedb_entries')
    .select('*, problem:psa_problems(id, problem_number, title)')
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccess(dbUser.role, UserRole.MANAGER))
    return NextResponse.json({ error: 'Manager role required' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const allowed = [
    'title', 'symptoms', 'root_cause', 'workaround', 'permanent_fix',
    'category', 'tags', 'audience', 'archived_at', 'expires_at',
  ]
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of allowed) if (body[k] !== undefined) update[k] = body[k]

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('psa_kedb_entries')
    .update(update)
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccess(dbUser.role, UserRole.ORG_ADMIN))
    return NextResponse.json({ error: 'Org Admin role required' }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin.from('psa_kedb_entries').delete().eq('id', id).eq('org_id', dbUser.org_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
