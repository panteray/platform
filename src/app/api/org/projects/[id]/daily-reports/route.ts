import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('daily_reports')
    .select('*, author:users!daily_reports_author_id_fkey(id, first_name, last_name), daily_report_items(id, description, hours, photos)')
    .eq('project_id', projectId)
    .order('report_date', { ascending: false })

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

  const admin = createAdminClient()

  const { data: project } = await admin
    .from('projects').select('id').eq('id', projectId).eq('org_id', dbUser.org_id).single()
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const insert: Record<string, unknown> = {
    org_id: dbUser.org_id,
    project_id: projectId,
    author_id: dbUser.id,
    report_date: (body.report_date as string) || new Date().toISOString().split('T')[0],
  }

  const allowed = ['summary', 'weather', 'crew_count', 'hours_worked', 'safety_notes', 'photos']
  for (const key of allowed) {
    if (body[key] !== undefined) insert[key] = body[key]
  }

  const { data, error } = await admin.from('daily_reports').insert(insert).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Create line items if provided
  const items = body.items as Array<Record<string, unknown>> | undefined
  if (items && Array.isArray(items) && items.length > 0) {
    const itemInserts = items.map(item => ({
      org_id: dbUser.org_id,
      report_id: data.id,
      task_id: (item.task_id as string) || null,
      description: (item.description as string) || '',
      hours: (item.hours as number) || 0,
      photos: item.photos || [],
    }))
    await admin.from('daily_report_items').insert(itemInserts)
  }

  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  const reportId = req.nextUrl.searchParams.get('report_id')
  if (!reportId) return NextResponse.json({ error: 'report_id required' }, { status: 400 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const admin = createAdminClient()
  const allowed = ['summary', 'weather', 'crew_count', 'hours_worked', 'safety_notes', 'photos', 'report_date']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (body[key] !== undefined) update[key] = body[key]
  }

  const { data, error } = await admin
    .from('daily_reports')
    .update(update)
    .eq('id', reportId)
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
  const reportId = req.nextUrl.searchParams.get('report_id')
  if (!reportId) return NextResponse.json({ error: 'report_id required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('daily_reports')
    .delete()
    .eq('id', reportId)
    .eq('project_id', projectId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
