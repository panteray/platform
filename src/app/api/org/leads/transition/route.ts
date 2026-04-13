import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyLeadCrud } from '@/lib/auth'
import { LeadStatus, LEAD_STATUS_TRANSITIONS } from '@/types/enums'

export async function POST(request: NextRequest) {
  const caller = await verifyLeadCrud()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, status: newStatus, archive_reason } = await request.json()
  if (!id || !newStatus) {
    return NextResponse.json({ error: 'id and status are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: lead, error: fetchErr } = await admin
    .from('leads')
    .select('*')
    .eq('id', id)
    .eq('org_id', caller.org_id)
    .single()

  if (fetchErr || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  // Validate transition
  const currentStatus = lead.status as LeadStatus
  const allowed = LEAD_STATUS_TRANSITIONS[currentStatus]
  if (!allowed || !allowed.includes(newStatus as LeadStatus)) {
    return NextResponse.json(
      { error: `Cannot transition from ${currentStatus} to ${newStatus}` },
      { status: 400 }
    )
  }

  // If archiving, require a reason
  if (newStatus === LeadStatus.ARCHIVED && !archive_reason) {
    return NextResponse.json(
      { error: 'archive_reason is required when archiving a lead' },
      { status: 400 }
    )
  }

  const updateData: Record<string, unknown> = { status: newStatus }
  if (newStatus === LeadStatus.ARCHIVED) {
    updateData.archive_reason = archive_reason
  }
  // Clear archive_reason when reopening
  if (currentStatus === LeadStatus.ARCHIVED && newStatus === LeadStatus.NEW) {
    updateData.archive_reason = null
  }

  const { data, error } = await admin.from('leads')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await admin.from('audit_log').insert({
    org_id: caller.org_id,
    user_id: caller.id,
    action: 'lead.status_changed',
    entity_type: 'lead',
    entity_id: id,
    details: { from: currentStatus, to: newStatus },
  })

  return NextResponse.json(data)
}
