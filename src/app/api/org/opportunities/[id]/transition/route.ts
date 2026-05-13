import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'
import { OppStatus, OPP_STATUS_ORDER } from '@/types/enums'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const newStatus = body.new_status as OppStatus
  if (!newStatus || !OPP_STATUS_ORDER.includes(newStatus)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

  const admin = createAdminClient()
  const { data: opp, error: fetchErr } = await admin
    .from('opportunities')
    .select('*')
    .eq('id', id)
    .single()
  if (fetchErr || !opp) return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
  if (opp.org_id !== caller.org_id) return NextResponse.json({ error: 'Not in your organization' }, { status: 403 })

  const previousStatus = opp.status as OppStatus

  const updateFields: Record<string, unknown> = { status: newStatus }
  if (newStatus === 'ON_HOLD') updateFields.on_hold_reason = body.on_hold_reason?.trim() || null
  if (body.decline_reason?.trim()) updateFields.decline_reason = body.decline_reason.trim()

  const { error: updateErr } = await admin.from('opportunities').update(updateFields).eq('id', id)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 })

  await admin.from('opp_status_history').insert({
    opp_id: id, org_id: caller.org_id, previous_status: previousStatus, new_status: newStatus,
    changed_by: caller.id, on_hold_reason: newStatus === 'ON_HOLD' ? (body.on_hold_reason?.trim() || null) : null,
    decline_reason: body.decline_reason?.trim() || null,
  })

  return NextResponse.json({ status: newStatus, previous_status: previousStatus })
}
