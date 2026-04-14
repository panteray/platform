import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PSA_STATUS_TRANSITIONS, PSA_WAITING_STATUSES, type PsaTicketStatus } from '@/types/database'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { to_status?: PsaTicketStatus; reason?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const toStatus = body.to_status
  if (!toStatus) return NextResponse.json({ error: 'to_status required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: ticket, error: fetchErr } = await admin
    .from('psa_tickets')
    .select('*')
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .single()

  if (fetchErr || !ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })

  const currentStatus = ticket.status as PsaTicketStatus
  const valid = PSA_STATUS_TRANSITIONS[currentStatus] ?? []
  if (!valid.includes(toStatus)) {
    return NextResponse.json({
      error: `Invalid transition: ${currentStatus} → ${toStatus}`,
      valid_next: valid,
    }, { status: 400 })
  }

  // Closeout gates: COMPLETED → RESOLVED requires all 9 gates (4 universal + 5 conditional)
  if (currentStatus === 'COMPLETED' && toStatus === 'RESOLVED') {
    const gateFailures: string[] = []

    // --- Universal Gates ---

    // G1: resolution_notes required (min 10 chars)
    if (!ticket.resolution_notes || (ticket.resolution_notes as string).trim().length < 10) {
      gateFailures.push('G1: Resolution notes required (min 10 chars)')
    }

    // G2: at least one time entry
    const { count: timeCount } = await admin
      .from('psa_time_entries')
      .select('*', { count: 'exact', head: true })
      .eq('ticket_id', id)
    if ((timeCount ?? 0) === 0) gateFailures.push('G2: At least one time entry required')

    // G3: assigned_to must be set
    if (!ticket.assigned_to) gateFailures.push('G3: Ticket must be assigned')

    // G4: category required (ticket must be categorized)
    if (!ticket.category || String(ticket.category).trim().length === 0) {
      gateFailures.push('G4: Ticket category required')
    }

    // --- Conditional Gates ---

    // G5 (cond): if job_type.require_photos, check photos exist
    if (ticket.job_type_id) {
      const { data: jobType } = await admin
        .from('psa_job_type_config')
        .select('require_photos')
        .eq('id', ticket.job_type_id)
        .single()
      if (jobType?.require_photos) {
        const { count: photoCount } = await admin
          .from('psa_ticket_photos')
          .select('*', { count: 'exact', head: true })
          .eq('ticket_id', id)
        if ((photoCount ?? 0) === 0) gateFailures.push('G5: Photos required per job type')
      }
    }

    // G6 (cond): CHANGE tickets must have their change window closed
    if (ticket.ticket_type === 'CHANGE') {
      const windowEnd = ticket.change_window_end ? new Date(ticket.change_window_end as string) : null
      if (!windowEnd) {
        gateFailures.push('G6: Change window end required on CHANGE tickets')
      } else if (windowEnd.getTime() > Date.now()) {
        gateFailures.push('G6: Change window must be closed before resolution')
      }
    }

    // G7 (cond): Child tickets — parent must be COMPLETED or RESOLVED
    if (ticket.parent_ticket_id) {
      const { data: parent } = await admin
        .from('psa_tickets')
        .select('status')
        .eq('id', ticket.parent_ticket_id)
        .single()
      const parentStatus = parent?.status as PsaTicketStatus | undefined
      if (parentStatus !== 'COMPLETED' && parentStatus !== 'RESOLVED') {
        gateFailures.push('G7: Parent ticket must be completed or resolved first')
      }
    }

    // G8 (cond): If ticket ever hit NEEDS_RMA, every parts row must have a serial number
    const { data: rmaHistory } = await admin
      .from('psa_ticket_status_log')
      .select('id')
      .eq('ticket_id', id)
      .eq('to_status', 'NEEDS_RMA')
      .limit(1)
    if (rmaHistory && rmaHistory.length > 0) {
      const { data: parts } = await admin
        .from('psa_ticket_parts')
        .select('id, serial_number')
        .eq('ticket_id', id)
      const missingSerials = (parts ?? []).filter((p) => !p.serial_number || String(p.serial_number).trim() === '')
      if (!parts || parts.length === 0) {
        gateFailures.push('G8: RMA tracked — parts record with serial number required')
      } else if (missingSerials.length > 0) {
        gateFailures.push(`G8: RMA tracked — ${missingSerials.length} part(s) missing serial number`)
      }
    }

    // G9 (cond): Customer-visible closeout evidence — at least one customer-visible note
    const { count: customerNoteCount } = await admin
      .from('psa_ticket_notes')
      .select('*', { count: 'exact', head: true })
      .eq('ticket_id', id)
      .eq('internal_only', false)
    if ((customerNoteCount ?? 0) === 0) {
      gateFailures.push('G9: At least one customer-visible note required')
    }

    if (gateFailures.length > 0) {
      return NextResponse.json({ error: 'Closeout gates failed', gate_failures: gateFailures }, { status: 400 })
    }
  }

  // Require reason on CANCELLED
  if (toStatus === 'CANCELLED' && !body.reason) {
    return NextResponse.json({ error: 'reason required when cancelling' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const update: Record<string, unknown> = {
    status: toStatus,
    updated_at: now,
  }

  // Mark first_response_at on first out-of-NEW transition
  if (currentStatus === 'NEW' && !ticket.first_response_at) {
    update.first_response_at = now
  }

  // Track completion milestones
  if (toStatus === 'COMPLETED') update.completed_at = now
  if (toStatus === 'RESOLVED') {
    update.resolved_at = now
    update.closed_at = now
  }

  // SLA clock pause/resume logic
  const wasWaiting = PSA_WAITING_STATUSES.includes(currentStatus)
  const isWaiting = PSA_WAITING_STATUSES.includes(toStatus)

  if (!wasWaiting && isWaiting) {
    // Entering waiting state — pause clock
    update.sla_paused_at = now
  } else if (wasWaiting && !isWaiting && ticket.sla_paused_at) {
    // Exiting waiting state — resume clock, accumulate paused time
    const pausedMs = Date.now() - new Date(ticket.sla_paused_at).getTime()
    const pausedMin = Math.floor(pausedMs / 60000)
    update.sla_total_pause_min = (ticket.sla_total_pause_min ?? 0) + pausedMin
    update.sla_paused_at = null
    // Push due dates forward by paused amount
    if (ticket.sla_response_due && !ticket.first_response_at) {
      update.sla_response_due = new Date(new Date(ticket.sla_response_due).getTime() + pausedMs).toISOString()
    }
    if (ticket.sla_resolution_due) {
      update.sla_resolution_due = new Date(new Date(ticket.sla_resolution_due).getTime() + pausedMs).toISOString()
    }
  }

  const { data, error } = await admin
    .from('psa_tickets')
    .update(update)
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log transition
  await admin.from('psa_ticket_status_log').insert({
    org_id: dbUser.org_id,
    ticket_id: id,
    from_status: currentStatus,
    to_status: toStatus,
    changed_by: dbUser.id,
    reason: body.reason ?? null,
  })

  // SLA event log
  if (!wasWaiting && isWaiting) {
    await admin.from('psa_sla_events').insert({
      org_id: dbUser.org_id,
      ticket_id: id,
      event_type: 'PAUSE',
      notes: `Status → ${toStatus}`,
    })
  } else if (wasWaiting && !isWaiting) {
    await admin.from('psa_sla_events').insert({
      org_id: dbUser.org_id,
      ticket_id: id,
      event_type: 'RESUME',
      duration_paused_min: update.sla_total_pause_min !== undefined
        ? (update.sla_total_pause_min as number) - (ticket.sla_total_pause_min ?? 0)
        : null,
      notes: `Status → ${toStatus}`,
    })
  }

  return NextResponse.json(data)
}
