import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'

const MEETING_TYPES = ['ikom', 'ckom', 'status', 'closeout', 'ad_hoc']

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const typeFilter = request.nextUrl.searchParams.get('type')

  const admin = createAdminClient()
  let query = admin
    .from('meeting_minutes')
    .select('*')
    .eq('project_id', projectId)
    .eq('org_id', caller.org_id)
    .order('meeting_date', { ascending: false })
  if (typeFilter) query = query.in('meeting_type', typeFilter.split(','))

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const meetingType = (body.meeting_type as string) || 'status'
  if (!MEETING_TYPES.includes(meetingType)) {
    return NextResponse.json({ error: `meeting_type must be one of: ${MEETING_TYPES.join(', ')}` }, { status: 400 })
  }
  if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: project, error: pErr } = await admin
    .from('projects')
    .select('id, org_id')
    .eq('id', projectId)
    .single()
  if (pErr || !project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  if (project.org_id !== caller.org_id) return NextResponse.json({ error: 'Not in your organization' }, { status: 403 })

  const insert = {
    org_id: caller.org_id,
    project_id: projectId,
    meeting_type: meetingType,
    title: (body.title as string).trim(),
    meeting_date: (body.meeting_date as string) || new Date().toISOString(),
    location: (body.location as string)?.trim() || null,
    attendees: Array.isArray(body.attendees) ? body.attendees : [],
    agenda: (body.agenda as string)?.trim() || null,
    discussion_notes: (body.discussion_notes as string)?.trim() || null,
    action_items: Array.isArray(body.action_items) ? body.action_items : [],
    decisions: Array.isArray(body.decisions) ? body.decisions : [],
    next_meeting_date: (body.next_meeting_date as string) || null,
    created_by: caller.id,
  }

  const { data: created, error: insErr } = await admin
    .from('meeting_minutes')
    .insert(insert)
    .select('*')
    .single()
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 })
  return NextResponse.json(created, { status: 201 })
}
