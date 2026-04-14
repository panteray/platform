import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  const admin = createAdminClient()
  const typeFilter = req.nextUrl.searchParams.get('type')

  let query = admin
    .from('raid_items')
    .select('*, owner:users!raid_items_owner_id_fkey(id, first_name, last_name), assignee:users!raid_items_assigned_to_fkey(id, first_name, last_name)')
    .eq('project_id', projectId)
    .eq('org_id', dbUser.org_id)
    .order('created_at', { ascending: false })

  if (typeFilter) query = query.eq('type', typeFilter)

  const { data, error } = await query
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
  const type = body.type as string
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })
  if (!['RISK', 'ACTION', 'ISSUE', 'DECISION'].includes(type)) {
    return NextResponse.json({ error: 'type must be RISK, ACTION, ISSUE, or DECISION' }, { status: 400 })
  }

  const admin = createAdminClient()

  const insert: Record<string, unknown> = {
    org_id: dbUser.org_id,
    project_id: projectId,
    title,
    type,
    created_by: dbUser.id,
  }

  const allowed = [
    'description', 'status', 'probability', 'impact', 'response_type',
    'response_actions', 'assigned_to', 'due_date', 'severity', 'resolution',
    'decision_maker', 'decision_date', 'rationale', 'category', 'owner_id', 'notes',
  ]
  for (const key of allowed) {
    if (body[key] !== undefined) insert[key] = body[key]
  }

  const { data, error } = await admin
    .from('raid_items')
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
  const itemId = req.nextUrl.searchParams.get('item_id')
  if (!itemId) return NextResponse.json({ error: 'item_id required' }, { status: 400 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const allowed = [
    'title', 'description', 'status', 'probability', 'impact', 'response_type',
    'response_actions', 'assigned_to', 'due_date', 'completed_at', 'severity',
    'resolution', 'decision_maker', 'decision_date', 'rationale', 'category',
    'owner_id', 'notes',
  ]

  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (body[key] !== undefined) update[key] = body[key]
  }

  // Auto-set completed_at when status → resolved/closed
  if (body.status === 'resolved' || body.status === 'closed') {
    update.completed_at = update.completed_at ?? new Date().toISOString()
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('raid_items')
    .update(update)
    .eq('id', itemId)
    .eq('project_id', projectId)
    .eq('org_id', dbUser.org_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  const itemId = req.nextUrl.searchParams.get('item_id')
  if (!itemId) return NextResponse.json({ error: 'item_id required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('raid_items')
    .delete()
    .eq('id', itemId)
    .eq('project_id', projectId)
    .eq('org_id', dbUser.org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
