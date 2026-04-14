import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  const admin = createAdminClient()
  const status = req.nextUrl.searchParams.get('status')

  const { data: project } = await admin
    .from('projects').select('id').eq('id', projectId).eq('org_id', dbUser.org_id).single()
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  let query = admin
    .from('project_tasks')
    .select('*, assignee:users!project_tasks_assignee_id_fkey(id, first_name, last_name)')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const title = (body.title as string)?.trim()
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: project } = await admin
    .from('projects').select('id').eq('id', projectId).eq('org_id', dbUser.org_id).single()
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const insert: Record<string, unknown> = {
    org_id: dbUser.org_id,
    project_id: projectId,
    title,
    created_by: dbUser.id,
  }

  const allowed = ['description', 'assignee_id', 'status', 'priority', 'area_id', 'due_date', 'sort_order']
  for (const key of allowed) {
    if (body[key] !== undefined) insert[key] = body[key]
  }

  const { data, error } = await admin.from('project_tasks').insert(insert).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  const taskId = req.nextUrl.searchParams.get('task_id')
  if (!taskId) return NextResponse.json({ error: 'task_id required' }, { status: 400 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const admin = createAdminClient()

  const allowed = ['title', 'description', 'assignee_id', 'status', 'priority', 'area_id', 'due_date', 'completed_at', 'sort_order']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (body[key] !== undefined) update[key] = body[key]
  }

  // Auto-set completed_at when status changes to done
  if (update.status === 'done' && !update.completed_at) {
    update.completed_at = new Date().toISOString()
  }

  const { data, error } = await admin
    .from('project_tasks')
    .update(update)
    .eq('id', taskId)
    .eq('project_id', projectId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  const taskId = req.nextUrl.searchParams.get('task_id')
  if (!taskId) return NextResponse.json({ error: 'task_id required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('project_tasks')
    .delete()
    .eq('id', taskId)
    .eq('project_id', projectId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
