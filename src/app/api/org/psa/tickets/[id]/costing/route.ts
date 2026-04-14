import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/roles'
import { UserRole } from '@/types/enums'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccess(dbUser.role, UserRole.MANAGER))
    return NextResponse.json({ error: 'Manager role required' }, { status: 403 })

  const admin = createAdminClient()

  const { data: costing, error: cErr } = await admin
    .from('psa_ticket_costing_v')
    .select('*')
    .eq('ticket_id', id)
    .eq('org_id', dbUser.org_id)
    .single()

  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 404 })

  // Include raw time/parts breakdown for the flyout
  const [timeRes, partsRes] = await Promise.all([
    admin
      .from('psa_time_entries')
      .select('*, user:users(id, first_name, last_name)')
      .eq('ticket_id', id)
      .eq('org_id', dbUser.org_id)
      .order('entry_date', { ascending: false }),
    admin
      .from('psa_ticket_parts')
      .select('*')
      .eq('ticket_id', id)
      .eq('org_id', dbUser.org_id)
      .order('created_at', { ascending: false }),
  ])

  return NextResponse.json({
    ...costing,
    time_entries: timeRes.data ?? [],
    parts: partsRes.data ?? [],
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccess(dbUser.role, UserRole.MANAGER))
    return NextResponse.json({ error: 'Manager role required' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const admin = createAdminClient()
  const allowed = ['estimated_hours', 'estimated_labor_cost', 'estimated_parts_cost', 'quoted_revenue', 'costing_enabled']
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of allowed) if (body[k] !== undefined) update[k] = body[k]

  const { data, error } = await admin
    .from('psa_tickets')
    .update(update)
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
