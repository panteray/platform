import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/roles'
import { UserRole } from '@/types/enums'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccess(dbUser.role, UserRole.MANAGER))
    return NextResponse.json({ error: 'Manager role required' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (typeof body.amount !== 'number' || body.amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  }
  if (!body.method) return NextResponse.json({ error: 'method required' }, { status: 400 })

  const admin = createAdminClient()

  // Insert payment
  const { data: payment, error: payErr } = await admin
    .from('invoice_payments')
    .insert({
      invoice_id: id,
      org_id: dbUser.org_id,
      amount: body.amount,
      method: body.method,
      reference_number: body.reference_number ?? null,
      paid_at: body.paid_at ?? new Date().toISOString(),
      recorded_by: dbUser.id,
      notes: body.notes ?? null,
    })
    .select()
    .single()

  if (payErr) return NextResponse.json({ error: payErr.message }, { status: 500 })

  // Recalculate amount_paid + status
  const { data: payments } = await admin
    .from('invoice_payments')
    .select('amount')
    .eq('invoice_id', id)
    .eq('org_id', dbUser.org_id)

  const totalPaid = (payments ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0)

  const { data: inv } = await admin
    .from('invoices')
    .select('total, status')
    .eq('id', id)
    .single()

  if (inv) {
    const total = Number(inv.total ?? 0)
    let newStatus = inv.status as string
    let paidAt: string | null = null
    if (totalPaid >= total - 0.005) {
      newStatus = 'PAID'
      paidAt = new Date().toISOString()
    } else if (totalPaid > 0) {
      newStatus = 'PARTIAL_PAID'
    }

    await admin
      .from('invoices')
      .update({
        amount_paid: totalPaid,
        status: newStatus,
        paid_at: paidAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('org_id', dbUser.org_id)
  }

  return NextResponse.json(payment, { status: 201 })
}
