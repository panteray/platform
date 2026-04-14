import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('qc_checklists')
    .select('*, submitted_user:users!qc_checklists_submitted_by_fkey(id, first_name, last_name), reviewer:users!qc_checklists_reviewed_by_fkey(id, first_name, last_name)')
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

  const admin = createAdminClient()

  const insert: Record<string, unknown> = {
    org_id: dbUser.org_id,
    project_id: projectId,
    created_by: dbUser.id,
  }

  const allowed = [
    'area_id', 'area_name', 'status', 'items', 'corrective_actions',
    'submitted_by', 'submitted_at', 'review_notes', 'photos',
  ]
  for (const key of allowed) {
    if (body[key] !== undefined) insert[key] = body[key]
  }

  const { data, error } = await admin
    .from('qc_checklists')
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
  const qcId = req.nextUrl.searchParams.get('qc_id')
  if (!qcId) return NextResponse.json({ error: 'qc_id required' }, { status: 400 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const allowed = [
    'area_name', 'status', 'items', 'corrective_actions',
    'submitted_by', 'submitted_at', 'reviewed_by', 'reviewed_at',
    'review_notes', 'photos',
  ]

  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (body[key] !== undefined) update[key] = body[key]
  }

  // Auto-set review fields
  if (body.status === 'approved' || body.status === 'failed') {
    update.reviewed_by = update.reviewed_by ?? dbUser.id
    update.reviewed_at = update.reviewed_at ?? new Date().toISOString()
  }
  if (body.status === 'submitted') {
    update.submitted_by = update.submitted_by ?? dbUser.id
    update.submitted_at = update.submitted_at ?? new Date().toISOString()
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('qc_checklists')
    .update(update)
    .eq('id', qcId)
    .eq('project_id', projectId)
    .eq('org_id', dbUser.org_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
