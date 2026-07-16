import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Attendee = { name?: string; role?: string; present?: boolean }

async function loadToken(token: string) {
  const admin = createAdminClient()
  const { data: row } = await admin
    .from('meeting_portal_tokens')
    .select('*')
    .eq('token', token)
    .eq('is_active', true)
    .single()
  if (!row) return { admin, row: null, error: 'Invalid or expired link' }
  if (new Date(row.expires_at) < new Date()) return { admin, row: null, error: 'This link has expired' }
  return { admin, row, error: null }
}

/** Public GET — customer-safe view of the kickoff meeting */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { admin, row, error } = await loadToken(token)
  if (!row) return NextResponse.json({ error }, { status: 404 })

  const { data: meeting } = await admin
    .from('meeting_minutes')
    .select('title, meeting_type, meeting_date, location, agenda, attendees, next_meeting_date, project_id, org_id')
    .eq('id', row.meeting_id)
    .single()
  if (!meeting) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })

  const [{ data: project }, { data: org }] = await Promise.all([
    admin.from('projects').select('name, pn').eq('id', meeting.project_id).single(),
    admin.from('organizations').select('name').eq('id', meeting.org_id).single(),
  ])

  // Customer-safe payload: no discussion notes, action items, or decisions
  return NextResponse.json({
    org_name: org?.name ?? null,
    project_name: project?.name ?? null,
    project_number: project?.pn ?? null,
    title: meeting.title,
    meeting_type: meeting.meeting_type,
    meeting_date: meeting.meeting_date,
    location: meeting.location,
    agenda: meeting.agenda,
    attendees: ((meeting.attendees as Attendee[]) ?? []).map((a) => ({ name: a.name ?? '', role: a.role ?? '' })),
    next_meeting_date: meeting.next_meeting_date,
    acknowledged_at: row.acknowledged_at,
    acknowledged_by_name: row.acknowledged_by_name,
  })
}

/** Public POST — customer acknowledges the kickoff details */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { admin, row, error } = await loadToken(token)
  if (!row) return NextResponse.json({ error }, { status: 404 })

  let body: { name?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  if (row.acknowledged_at) return NextResponse.json({ error: 'Already acknowledged' }, { status: 409 })

  const now = new Date().toISOString()
  const { error: uErr } = await admin
    .from('meeting_portal_tokens')
    .update({ acknowledged_at: now, acknowledged_by_name: body.name.trim() })
    .eq('id', row.id)
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 400 })

  return NextResponse.json({ acknowledged_at: now })
}
