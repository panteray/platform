import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { DISPATCH_TO_TICKET_STATUS, PSA_STATUS_TRANSITIONS, type PsaDispatchStatus } from '@/types/database'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { status?: PsaDispatchStatus; reason?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.status) return NextResponse.json({ error: 'status required' }, { status: 400 })

  const admin = createAdminClient()

  // Load assignment + current ticket status
  const { data: assignment, error: loadErr } = await admin
    .from('psa_dispatch_assignments')
    .select('*, ticket:psa_tickets(id, status)')
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .single()

  if (loadErr || !assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })

  // Update assignment
  const { error: updateErr } = await admin
    .from('psa_dispatch_assignments')
    .update({ status: body.status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', dbUser.org_id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // Cascade to ticket status (if mapping defined and transition is legal)
  const cascadeTarget = DISPATCH_TO_TICKET_STATUS[body.status]
  const ticket = assignment.ticket as { id: string; status: keyof typeof PSA_STATUS_TRANSITIONS } | null
  if (cascadeTarget && ticket && ticket.status !== cascadeTarget) {
    const validTransitions = PSA_STATUS_TRANSITIONS[ticket.status] ?? []
    if (validTransitions.includes(cascadeTarget)) {
      const now = new Date().toISOString()
      const ticketUpdate: Record<string, unknown> = { status: cascadeTarget, updated_at: now }
      if (cascadeTarget === 'COMPLETED') ticketUpdate.completed_at = now

      await admin
        .from('psa_tickets')
        .update(ticketUpdate)
        .eq('id', ticket.id)
        .eq('org_id', dbUser.org_id)

      await admin.from('psa_ticket_status_log').insert({
        org_id: dbUser.org_id,
        ticket_id: ticket.id,
        from_status: ticket.status,
        to_status: cascadeTarget,
        changed_by: dbUser.id,
        reason: body.reason ?? `Dispatch → ${body.status}`,
      })
    }
  }

  return NextResponse.json({ ok: true, status: body.status, cascaded_to: cascadeTarget })
}
