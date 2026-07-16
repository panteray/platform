import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'
import { OppStatus } from '@/types/enums'

type BookingState = 'soft_book' | 'hard_book' | 'cancelled'

const EDITABLE_FIELDS = [
  'requested_start_date', 'requested_end_date',
  'confirmed_start_date', 'confirmed_end_date',
  'cutoff_date', 'poc_name', 'poc_email', 'poc_phone', 'notes',
]

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reqId: string }> }
) {
  const { id: projectId, reqId } = await params
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: req, error: fErr } = await admin
    .from('scheduling_requests')
    .select('*, projects!inner(id, opp_id)')
    .eq('id', reqId)
    .eq('project_id', projectId)
    .eq('org_id', caller.org_id)
    .single()
  if (fErr || !req) return NextResponse.json({ error: 'Scheduling request not found' }, { status: 404 })

  const update: Record<string, unknown> = {}
  for (const f of EDITABLE_FIELDS) {
    if (f in body) update[f] = body[f] === '' ? null : body[f]
  }

  const newState = body.state as BookingState | undefined
  const previousState = req.state as BookingState
  if (newState && newState !== previousState) {
    if (!['soft_book', 'hard_book', 'cancelled'].includes(newState)) {
      return NextResponse.json({ error: 'Invalid state' }, { status: 400 })
    }
    if (previousState === 'cancelled') {
      return NextResponse.json({ error: 'Cannot transition a cancelled request' }, { status: 400 })
    }
    if (newState === 'cancelled' && !(body.cancelled_reason as string | undefined)?.trim()) {
      return NextResponse.json({ error: 'cancelled_reason is required' }, { status: 400 })
    }
    update.state = newState
    if (newState === 'hard_book') {
      update.hard_booked_at = new Date().toISOString()
      if (!('confirmed_start_date' in body) && !req.confirmed_start_date) {
        update.confirmed_start_date = req.requested_start_date
      }
      if (!('confirmed_end_date' in body) && !req.confirmed_end_date) {
        update.confirmed_end_date = req.requested_end_date
      }
    }
    if (newState === 'cancelled') {
      update.cancelled_at = new Date().toISOString()
      update.cancelled_reason = (body.cancelled_reason as string).trim()
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
  }

  const { data: updated, error: uErr } = await admin
    .from('scheduling_requests')
    .update(update)
    .eq('id', reqId)
    .select('*')
    .single()
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 400 })

  const oppId = (req.projects as unknown as { opp_id: string | null }).opp_id
  if (newState === 'hard_book' && oppId) {
    const { data: opp } = await admin.from('opportunities').select('status').eq('id', oppId).single()
    if (opp?.status === OppStatus.SCHEDULING) {
      await admin.from('opportunities').update({ status: OppStatus.AWAITING_DELIVERY }).eq('id', oppId)
      await admin.from('opp_status_history').insert({
        opp_id: oppId, org_id: caller.org_id,
        previous_status: OppStatus.SCHEDULING, new_status: OppStatus.AWAITING_DELIVERY,
        changed_by: caller.id,
      })
    }
  }

  return NextResponse.json(updated)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; reqId: string }> }
) {
  const { id: projectId, reqId } = await params
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('scheduling_requests')
    .delete()
    .eq('id', reqId)
    .eq('project_id', projectId)
    .eq('org_id', caller.org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
