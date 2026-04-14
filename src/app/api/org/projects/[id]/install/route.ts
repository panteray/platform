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
  const areaId = req.nextUrl.searchParams.get('area_id')

  let query = admin
    .from('install_items')
    .select('*, installer:users!install_items_installed_by_fkey(id, first_name, last_name)')
    .eq('project_id', projectId)
    .order('hw_schedule_line', { ascending: true, nullsFirst: false })

  if (status) query = query.eq('status', status)
  if (areaId) query = query.eq('area_id', areaId)

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

  const label = (body.label as string)?.trim()
  if (!label) return NextResponse.json({ error: 'label is required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: project } = await admin
    .from('projects').select('id').eq('id', projectId).eq('org_id', dbUser.org_id).single()
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const insert: Record<string, unknown> = {
    org_id: dbUser.org_id,
    project_id: projectId,
    label,
  }

  const allowed = [
    'device_id', 'area_id', 'hw_schedule_line', 'category', 'description',
    'vendor', 'model', 'quantity', 'status', 'position_x', 'position_y',
  ]
  for (const key of allowed) {
    if (body[key] !== undefined) insert[key] = body[key]
  }

  const { data, error } = await admin.from('install_items').insert(insert).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
