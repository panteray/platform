import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/roles'
import { UserRole } from '@/types/enums'

export async function POST(req: NextRequest) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccess(dbUser.role, UserRole.MANAGER))
    return NextResponse.json({ error: 'Manager role required' }, { status: 403 })

  let body: { ticket_id?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!body.ticket_id) return NextResponse.json({ error: 'ticket_id required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: ticket, error: tErr } = await admin
    .from('psa_tickets')
    .select('id, ticket_number, title, customer_id, status')
    .eq('id', body.ticket_id)
    .eq('org_id', dbUser.org_id)
    .single()

  if (tErr || !ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
  if (!ticket.customer_id) return NextResponse.json({ error: 'Ticket has no customer' }, { status: 400 })

  // Pull billable time entries
  const { data: timeEntries } = await admin
    .from('psa_time_entries')
    .select('id, hours, description, billable, rate, user_id')
    .eq('ticket_id', body.ticket_id)
    .eq('org_id', dbUser.org_id)
    .eq('billable', true)

  // Pull parts
  const { data: parts } = await admin
    .from('psa_ticket_parts')
    .select('id, part_number, description, quantity, cost, markup_pct')
    .eq('ticket_id', body.ticket_id)
    .eq('org_id', dbUser.org_id)

  // Create draft invoice
  const today = new Date().toISOString().slice(0, 10)
  const due = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

  const { data: invoice, error: invErr } = await admin
    .from('invoices')
    .insert({
      org_id: dbUser.org_id,
      customer_id: ticket.customer_id,
      source: 'TICKET',
      source_ticket_id: body.ticket_id,
      issued_at: today,
      due_date: due,
      payment_terms_days: 30,
      notes: `Generated from ${ticket.ticket_number}: ${ticket.title}`,
      created_by: dbUser.id,
    })
    .select()
    .single()

  if (invErr || !invoice) return NextResponse.json({ error: invErr?.message ?? 'Insert failed' }, { status: 500 })

  // Build line items
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
        org_id: dbUser.org_id,
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
        org_id: dbUser.org_id,
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

  return NextResponse.json({ ...invoice, subtotal: +subtotal.toFixed(2) }, { status: 201 })
}
