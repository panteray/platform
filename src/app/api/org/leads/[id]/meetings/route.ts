import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyLeadCrud, verifyLeadRead } from '@/lib/auth'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await verifyLeadRead()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: leadId } = await params
  const admin = createAdminClient()

  const { data: lead } = await admin.from('leads').select('org_id').eq('id', leadId).single()
  if (!lead || lead.org_id !== caller.org_id) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  const { data, error } = await admin
    .from('lead_meetings')
    .select('*')
    .eq('lead_id', leadId)
    .eq('org_id', caller.org_id)
    .order('start_time', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await verifyLeadCrud()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: leadId } = await params
  const body = await request.json()
  const admin = createAdminClient()

  const { data: lead } = await admin.from('leads').select('org_id').eq('id', leadId).single()
  if (!lead || lead.org_id !== caller.org_id) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  if (!body.title || !body.start_time || !body.end_time) {
    return NextResponse.json({ error: 'title, start_time, and end_time are required' }, { status: 400 })
  }

  const { data, error } = await admin.from('lead_meetings').insert({
    org_id: caller.org_id,
    lead_id: leadId,
    opp_id: body.opp_id ?? null,
    title: body.title,
    description: body.description ?? null,
    location: body.location ?? null,
    start_time: body.start_time,
    end_time: body.end_time,
    attendees: body.attendees ?? [],
    outcome: body.outcome ?? null,
    created_by: caller.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await admin.from('audit_log').insert({
    org_id: caller.org_id,
    user_id: caller.id,
    action: 'lead_meeting.created',
    entity_type: 'lead_meeting',
    entity_id: data.id,
    details: { lead_id: leadId, title: body.title },
  })

  return NextResponse.json(data)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await verifyLeadCrud()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: leadId } = await params
  const { searchParams } = new URL(request.url)
  const meetingId = searchParams.get('meetingId')
  if (!meetingId) return NextResponse.json({ error: 'Missing meetingId' }, { status: 400 })

  const admin = createAdminClient()

  const { data: meeting } = await admin
    .from('lead_meetings')
    .select('org_id, lead_id')
    .eq('id', meetingId)
    .single()

  if (!meeting || meeting.org_id !== caller.org_id || meeting.lead_id !== leadId) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
  }

  const { error } = await admin.from('lead_meetings').delete().eq('id', meetingId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
