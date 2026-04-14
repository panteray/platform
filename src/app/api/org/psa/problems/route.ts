import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/roles'
import { UserRole } from '@/types/enums'

export async function GET(req: NextRequest) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = req.nextUrl.searchParams.get('status')
  const customerId = req.nextUrl.searchParams.get('customer_id')
  const assigned = req.nextUrl.searchParams.get('assigned_to')

  const admin = createAdminClient()
  let query = admin
    .from('psa_problems')
    .select('*, customer:customers(id, name), assignee:users!assigned_to(id, first_name, last_name, email)')
    .eq('org_id', dbUser.org_id)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (customerId) query = query.eq('customer_id', customerId)
  if (assigned) query = query.eq('assigned_to', assigned)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccess(dbUser.role, UserRole.MANAGER))
    return NextResponse.json({ error: 'Manager role required' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.title) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('psa_problems')
    .insert({
      org_id: dbUser.org_id,
      title: body.title,
      description: body.description ?? null,
      problem_type: body.problem_type ?? 'REACTIVE',
      priority: body.priority ?? null,
      customer_id: body.customer_id ?? null,
      category: body.category ?? null,
      assigned_to: body.assigned_to ?? null,
      created_by: dbUser.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log initial status
  await admin.from('psa_problem_status_log').insert({
    problem_id: data.id,
    org_id: dbUser.org_id,
    from_status: null,
    to_status: 'NEW',
    changed_by: dbUser.id,
    reason: 'Problem created',
  })

  // If linked ticket IDs provided, link them
  if (Array.isArray(body.linked_ticket_ids) && body.linked_ticket_ids.length > 0) {
    const links = (body.linked_ticket_ids as string[]).map(ticketId => ({
      problem_id: data.id,
      ticket_id: ticketId,
      org_id: dbUser.org_id,
      linked_by: dbUser.id,
    }))
    await admin.from('psa_problem_tickets').insert(links)
  }

  return NextResponse.json(data, { status: 201 })
}
