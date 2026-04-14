import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/roles'
import { UserRole } from '@/types/enums'
import { PSA_PROBLEM_STATUS_TRANSITIONS, type PsaProblemStatus } from '@/types/database'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: problem, error } = await admin
    .from('psa_problems')
    .select('*, customer:customers(id, name), assignee:users!assigned_to(id, first_name, last_name, email)')
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  const [ticketsRes, logRes] = await Promise.all([
    admin
      .from('psa_problem_tickets')
      .select('*, ticket:psa_tickets(id, ticket_number, title, status, priority, created_at)')
      .eq('problem_id', id)
      .eq('org_id', dbUser.org_id)
      .order('linked_at', { ascending: false }),
    admin
      .from('psa_problem_status_log')
      .select('*, changed_by_user:users!changed_by(id, first_name, last_name)')
      .eq('problem_id', id)
      .eq('org_id', dbUser.org_id)
      .order('created_at', { ascending: true }),
  ])

  return NextResponse.json({
    ...problem,
    linked_tickets: ticketsRes.data ?? [],
    status_log: logRes.data ?? [],
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

  // Handle status transition separately
  if (body.status) {
    const { data: current } = await admin
      .from('psa_problems')
      .select('status')
      .eq('id', id)
      .eq('org_id', dbUser.org_id)
      .single()

    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const fromStatus = current.status as PsaProblemStatus
    const toStatus = body.status as PsaProblemStatus
    const valid = PSA_PROBLEM_STATUS_TRANSITIONS[fromStatus] ?? []
    if (!valid.includes(toStatus)) {
      return NextResponse.json({ error: `Cannot transition from ${fromStatus} to ${toStatus}` }, { status: 400 })
    }

    await admin.from('psa_problem_status_log').insert({
      problem_id: id,
      org_id: dbUser.org_id,
      from_status: fromStatus,
      to_status: toStatus,
      changed_by: dbUser.id,
      reason: body.reason as string | undefined ?? null,
    })

    // Side effects on terminal statuses
    if (toStatus === 'RESOLVED' && !body.resolved_at) body.resolved_at = new Date().toISOString()
    if (toStatus === 'CLOSED' && !body.closed_at) body.closed_at = new Date().toISOString()
  }

  const allowed = [
    'title', 'description', 'problem_type', 'status', 'priority', 'customer_id', 'category',
    'rca_method', 'rca_five_whys', 'rca_fishbone', 'rca_free_text',
    'root_cause', 'workaround', 'permanent_fix',
    'resolved_at', 'closed_at', 'assigned_to',
  ]
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of allowed) if (body[k] !== undefined) update[k] = body[k]

  const { data, error } = await admin
    .from('psa_problems')
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
  const { error } = await admin.from('psa_problems').delete().eq('id', id).eq('org_id', dbUser.org_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
