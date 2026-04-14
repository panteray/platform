import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const CO_TRANSITIONS: Record<string, string[]> = {
  initiated: ['classified'],
  classified: ['engineering_delegated', 'quote_delegated', 'pm_review'],
  engineering_delegated: ['quote_delegated', 'pm_review'],
  quote_delegated: ['pm_review'],
  pm_review: ['customer_sig', 'injected', 'closed'], // minor skips customer_sig
  customer_sig: ['injected', 'closed'],
  injected: ['field_acknowledged'],
  field_acknowledged: ['closed'],
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('change_orders')
    .select('*, initiated:users!change_orders_initiated_by_fkey(id, first_name, last_name), install_item:install_items(id, label, category)')
    .eq('project_id', projectId)
    .eq('org_id', dbUser.org_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const title = (body.title as string)?.trim()
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })

  const admin = createAdminClient()

  const insert: Record<string, unknown> = {
    org_id: dbUser.org_id,
    project_id: projectId,
    title,
    initiated_by: dbUser.id,
    status: 'initiated',
  }

  const allowed = [
    'type', 'description', 'reason', 'cost_impact', 'price_change',
    'schedule_impact_days', 'install_item_id', 'notes',
  ]
  for (const key of allowed) {
    if (body[key] !== undefined) insert[key] = body[key]
  }

  const { data, error } = await admin
    .from('change_orders')
    .insert(insert)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  const coId = req.nextUrl.searchParams.get('co_id')
  if (!coId) return NextResponse.json({ error: 'co_id required' }, { status: 400 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const admin = createAdminClient()

  // Validate status transition if status is being changed
  if (body.status) {
    const { data: current } = await admin
      .from('change_orders')
      .select('status, type')
      .eq('id', coId)
      .eq('project_id', projectId)
      .eq('org_id', dbUser.org_id)
      .single()

    if (!current) return NextResponse.json({ error: 'CO not found' }, { status: 404 })

    const allowed = CO_TRANSITIONS[current.status] ?? []
    if (!allowed.includes(body.status as string)) {
      return NextResponse.json({
        error: `Cannot transition from ${current.status} to ${body.status}. Allowed: ${allowed.join(', ')}`,
      }, { status: 400 })
    }

    // Auto-set timestamps based on status
    const now = new Date().toISOString()
    switch (body.status) {
      case 'injected': body.injected_at = now; break
      case 'field_acknowledged':
        body.field_acknowledged_by = dbUser.id
        body.field_acknowledged_at = now
        break
      case 'closed':
        body.closed_by = dbUser.id
        body.closed_at = now
        break
    }
  }

  const updateAllowed = [
    'type', 'status', 'title', 'description', 'reason', 'cost_impact',
    'price_change', 'schedule_impact_days', 'notes',
    'engineering_assignee_id', 'engineering_notes', 'engineering_completed_at',
    'quote_assignee_id', 'quote_amount', 'quote_notes', 'quote_completed_at',
    'pm_approved_by', 'pm_approved_at', 'pm_decline_reason',
    'customer_signed_at', 'customer_sig_data',
    'injected_at', 'field_acknowledged_by', 'field_acknowledged_at',
    'closed_at', 'closed_by',
  ]

  const update: Record<string, unknown> = {}
  for (const key of updateAllowed) {
    if (body[key] !== undefined) update[key] = body[key]
  }

  const { data, error } = await admin
    .from('change_orders')
    .update(update)
    .eq('id', coId)
    .eq('project_id', projectId)
    .eq('org_id', dbUser.org_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
