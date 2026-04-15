import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/roles'
import { UserRole } from '@/types/enums'
import { generateInvoiceFromTicket } from '@/lib/psa-invoicing'

export async function POST(req: NextRequest) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccess(dbUser.role, UserRole.MANAGER))
    return NextResponse.json({ error: 'Manager role required' }, { status: 403 })

  let body: { ticket_id?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!body.ticket_id) return NextResponse.json({ error: 'ticket_id required' }, { status: 400 })

  const admin = createAdminClient()
  const result = await generateInvoiceFromTicket(admin, {
    orgId: dbUser.org_id,
    ticketId: body.ticket_id,
    createdBy: dbUser.id,
    source: 'MANUAL',
  })

  if (!result.created) {
    const status = result.reason === 'Ticket not found' ? 404
      : result.reason === 'Invoice already exists for ticket' ? 409
      : 400
    return NextResponse.json({ error: result.reason, invoice_id: result.invoice_id }, { status })
  }

  // Return the newly created invoice
  const { data: invoice } = await admin
    .from('invoices')
    .select('*')
    .eq('id', result.invoice_id!)
    .single()

  return NextResponse.json(invoice, { status: 201 })
}
