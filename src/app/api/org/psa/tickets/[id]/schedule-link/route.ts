import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/org/psa/tickets/[id]/schedule-link
 * Generates a customer self-scheduling token for P4/P5 tickets.
 * Returns the portal URL the user can send to the customer.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: ticket, error } = await admin
    .from('psa_tickets')
    .select('id, org_id, priority, customer_id, ticket_number')
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .single()

  if (error || !ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })

  if (!['P4', 'P5'].includes(ticket.priority)) {
    return NextResponse.json({ error: 'Self-scheduling only available for P4/P5 tickets' }, { status: 400 })
  }

  // Reuse active token if one already exists
  const { data: existing } = await admin
    .from('dispatch_schedule_tokens')
    .select('token, expires_at')
    .eq('ticket_id', id)
    .eq('is_active', true)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  let token = existing?.token
  if (!token) {
    const { data: inserted, error: insErr } = await admin
      .from('dispatch_schedule_tokens')
      .insert({
        org_id: ticket.org_id,
        ticket_id: ticket.id,
        customer_id: ticket.customer_id,
        created_by: dbUser.id,
      })
      .select('token')
      .single()
    if (insErr || !inserted) return NextResponse.json({ error: insErr?.message ?? 'Failed to create token' }, { status: 500 })
    token = inserted.token
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const url = `${origin}/portal/schedule/${token}`
  return NextResponse.json({ token, url, ticket_number: ticket.ticket_number })
}
