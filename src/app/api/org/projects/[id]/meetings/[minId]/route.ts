import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'
import { OppStatus } from '@/types/enums'

const EDITABLE_FIELDS = [
  'title', 'meeting_type', 'meeting_date', 'location', 'attendees',
  'agenda', 'discussion_notes', 'action_items', 'decisions', 'next_meeting_date',
]

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; minId: string }> }
) {
  const { id: projectId, minId } = await params
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: meeting, error: fErr } = await admin
    .from('meeting_minutes')
    .select('*, projects!inner(id, opp_id)')
    .eq('id', minId)
    .eq('project_id', projectId)
    .eq('org_id', caller.org_id)
    .single()
  if (fErr || !meeting) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })

  const update: Record<string, unknown> = {}
  for (const f of EDITABLE_FIELDS) {
    if (f in body) update[f] = body[f] === '' ? null : body[f]
  }

  // mark_held: stamp held_at and drive the parent opp forward
  const markHeld = body.mark_held === true
  if (markHeld && !meeting.held_at) {
    update.held_at = new Date().toISOString()
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
  }

  const { data: updated, error: uErr } = await admin
    .from('meeting_minutes')
    .update(update)
    .eq('id', minId)
    .select('*')
    .single()
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 400 })

  // Opp transitions: IKOM held -> CKOM; CKOM held -> SCHEDULING
  const oppId = (meeting.projects as unknown as { opp_id: string | null }).opp_id
  if (markHeld && !meeting.held_at && oppId) {
    const { data: opp } = await admin.from('opportunities').select('status').eq('id', oppId).single()
    let from: OppStatus | null = null
    let to: OppStatus | null = null
    if (meeting.meeting_type === 'ikom' && opp?.status === OppStatus.IKOM) {
      from = OppStatus.IKOM; to = OppStatus.CKOM
    } else if (meeting.meeting_type === 'ckom' && opp?.status === OppStatus.CKOM) {
      from = OppStatus.CKOM; to = OppStatus.SCHEDULING
    }
    if (from && to) {
      await admin.from('opportunities').update({ status: to }).eq('id', oppId)
      await admin.from('opp_status_history').insert({
        opp_id: oppId, org_id: caller.org_id, previous_status: from, new_status: to,
        changed_by: caller.id,
      })
    }
  }

  return NextResponse.json(updated)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; minId: string }> }
) {
  const { id: projectId, minId } = await params
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('meeting_minutes')
    .delete()
    .eq('id', minId)
    .eq('project_id', projectId)
    .eq('org_id', caller.org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
