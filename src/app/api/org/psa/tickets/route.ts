import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const vertical = sp.get('vertical')
  const status = sp.get('status')
  const priority = sp.get('priority')
  const assignedTo = sp.get('assigned_to')
  const customerId = sp.get('customer_id')
  const myTickets = sp.get('mine') === '1'

  const admin = createAdminClient()
  let query = admin
    .from('psa_tickets')
    .select('*, customer:customers(id, name), asset:assets(id, label, vendor, model), assignee:users!psa_tickets_assigned_to_fkey(id, first_name, last_name, email)')
    .eq('org_id', dbUser.org_id)
    .order('created_at', { ascending: false })

  if (vertical) query = query.eq('vertical', vertical)
  if (status) query = query.eq('status', status)
  if (priority) query = query.eq('priority', priority)
  if (assignedTo) query = query.eq('assigned_to', assignedTo)
  if (customerId) query = query.eq('customer_id', customerId)
  if (myTickets) query = query.eq('assigned_to', dbUser.id)

  const { data, error } = await query.limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.title) return NextResponse.json({ error: 'title required' }, { status: 400 })
  if (!body.vertical) return NextResponse.json({ error: 'vertical required' }, { status: 400 })

  const admin = createAdminClient()
  const ticketType = (body.ticket_type as string) ?? 'INCIDENT'
  const priority = (body.priority as string) ?? 'P3'

  // Look up SLA policy for vertical + type + priority
  const { data: policy } = await admin
    .from('psa_sla_policies')
    .select('id, response_min, resolution_min')
    .eq('org_id', dbUser.org_id)
    .eq('vertical', body.vertical)
    .eq('ticket_type', ticketType)
    .eq('priority', priority)
    .maybeSingle()

  const now = new Date()
  const slaResponseDue = policy ? new Date(now.getTime() + policy.response_min * 60000).toISOString() : null
  const slaResolutionDue = policy ? new Date(now.getTime() + policy.resolution_min * 60000).toISOString() : null

  const allowed = [
    'customer_id', 'asset_id', 'site_id', 'project_id', 'parent_ticket_id',
    'vertical', 'category', 'ticket_type', 'priority', 'title', 'description',
    'assigned_to', 'job_type_id', 'costing_enabled',
    'change_window_start', 'change_window_end', 'required_skills',
  ]
  const insert: Record<string, unknown> = {
    org_id: dbUser.org_id,
    created_by: dbUser.id,
    sla_policy_id: policy?.id ?? null,
    sla_response_due: slaResponseDue,
    sla_resolution_due: slaResolutionDue,
    status: 'NEW',
  }
  for (const k of allowed) if (body[k] !== undefined) insert[k] = body[k]

  const { data, error } = await admin.from('psa_tickets').insert(insert).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log status entry + SLA clock start
  await admin.from('psa_ticket_status_log').insert({
    org_id: dbUser.org_id,
    ticket_id: data.id,
    from_status: null,
    to_status: 'NEW',
    changed_by: dbUser.id,
    reason: 'Ticket created',
  })
  if (policy) {
    await admin.from('psa_sla_events').insert({
      org_id: dbUser.org_id,
      ticket_id: data.id,
      event_type: 'CLOCK_START',
    })
  }

  return NextResponse.json(data, { status: 201 })
}
