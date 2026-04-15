/**
 * Shared invoice generation from PSA tickets.
 * Used by both the manual generate-from-ticket route and the
 * auto-invoice hook in the ticket transition handler (G12c).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

type Admin = SupabaseClient

export interface GenerateInvoiceResult {
  created: boolean
  invoice_id?: string
  subtotal?: number
  reason?: string
}

/**
 * Generate a DRAFT invoice from a ticket's billable time entries and parts.
 * Returns { created: false, reason } when skipped (no customer, no lines, duplicate).
 */
export async function generateInvoiceFromTicket(
  admin: Admin,
  opts: {
    orgId: string
    ticketId: string
    createdBy: string
    source?: 'MANUAL' | 'TICKET_AUTO'
  }
): Promise<GenerateInvoiceResult> {
  const { orgId, ticketId, createdBy, source = 'MANUAL' } = opts

  const { data: ticket, error: tErr } = await admin
    .from('psa_tickets')
    .select('id, ticket_number, title, customer_id')
    .eq('id', ticketId)
    .eq('org_id', orgId)
    .single()

  if (tErr || !ticket) return { created: false, reason: 'Ticket not found' }
  if (!ticket.customer_id) return { created: false, reason: 'Ticket has no customer' }

  // Duplicate guard — skip if an invoice already exists for this ticket
  const { data: existing } = await admin
    .from('invoices')
    .select('id')
    .eq('org_id', orgId)
    .eq('source_ticket_id', ticketId)
    .limit(1)
    .maybeSingle()
  if (existing) return { created: false, reason: 'Invoice already exists for ticket', invoice_id: existing.id }

  const { data: timeEntries } = await admin
    .from('psa_time_entries')
    .select('id, hours, description, billable, rate')
    .eq('ticket_id', ticketId)
    .eq('org_id', orgId)
    .eq('billable', true)

  const { data: parts } = await admin
    .from('psa_ticket_parts')
    .select('id, part_number, description, quantity, cost, markup_pct')
    .eq('ticket_id', ticketId)
    .eq('org_id', orgId)

  const hasLines =
    (timeEntries ?? []).some(t => Number(t.hours ?? 0) * Number(t.rate ?? 0) > 0) ||
    (parts ?? []).some(p => Number(p.quantity ?? 0) * Number(p.cost ?? 0) > 0)

  if (!hasLines) return { created: false, reason: 'No billable lines' }

  const today = new Date().toISOString().slice(0, 10)
  const due = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

  const { data: invoice, error: invErr } = await admin
    .from('invoices')
    .insert({
      org_id: orgId,
      customer_id: ticket.customer_id,
      source,
      source_ticket_id: ticketId,
      issued_at: today,
      due_date: due,
      payment_terms_days: 30,
      notes: `Generated from ${ticket.ticket_number}: ${ticket.title}`,
      created_by: createdBy,
    })
    .select()
    .single()

  if (invErr || !invoice) return { created: false, reason: invErr?.message ?? 'Insert failed' }

  const lineRows: Array<Record<string, unknown>> = []
  let subtotal = 0

  for (const t of timeEntries ?? []) {
    const hours = Number(t.hours ?? 0)
    const rate = Number(t.rate ?? 0)
    const lineTotal = hours * rate
    if (lineTotal > 0) {
      subtotal += lineTotal
      lineRows.push({
        invoice_id: invoice.id,
        org_id: orgId,
        description: t.description ?? 'Labor',
        quantity: hours,
        unit_price: rate,
        source_type: 'LABOR',
        source_ref_id: t.id,
      })
    }
  }

  for (const p of parts ?? []) {
    const cost = Number(p.cost ?? 0)
    const markup = Number(p.markup_pct ?? 0)
    const unitPrice = cost * (1 + markup / 100)
    const qty = Number(p.quantity ?? 1)
    const lineTotal = qty * unitPrice
    if (lineTotal > 0) {
      subtotal += lineTotal
      lineRows.push({
        invoice_id: invoice.id,
        org_id: orgId,
        description: p.description + (p.part_number ? ` (${p.part_number})` : ''),
        quantity: qty,
        unit_price: +unitPrice.toFixed(2),
        source_type: 'PARTS',
        source_ref_id: p.id,
      })
    }
  }

  if (lineRows.length > 0) {
    await admin.from('invoice_line_items').insert(lineRows)
  }

  await admin
    .from('invoices')
    .update({ subtotal: +subtotal.toFixed(2), updated_at: new Date().toISOString() })
    .eq('id', invoice.id)

  return { created: true, invoice_id: invoice.id, subtotal: +subtotal.toFixed(2) }
}
