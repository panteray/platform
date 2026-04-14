import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/roles'
import { UserRole } from '@/types/enums'

function advanceDate(iso: string, cycle: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL'): string {
  const d = new Date(iso)
  if (cycle === 'MONTHLY') d.setMonth(d.getMonth() + 1)
  else if (cycle === 'QUARTERLY') d.setMonth(d.getMonth() + 3)
  else d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().slice(0, 10)
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccess(dbUser.role, UserRole.MANAGER))
    return NextResponse.json({ error: 'Manager role required' }, { status: 403 })

  const admin = createAdminClient()

  const { data: contract, error: cErr } = await admin
    .from('service_contracts')
    .select('*')
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .single()

  if (cErr || !contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
  if (contract.status !== 'ACTIVE') {
    return NextResponse.json({ error: `Contract is ${contract.status}, must be ACTIVE` }, { status: 400 })
  }

  const { data: lines } = await admin
    .from('contract_line_items')
    .select('description, monthly_amount')
    .eq('contract_id', id)
    .eq('org_id', dbUser.org_id)

  if (!lines || lines.length === 0) {
    return NextResponse.json({ error: 'Contract has no line items to bill' }, { status: 400 })
  }

  // Cycle multiplier
  const mult = contract.billing_cycle === 'QUARTERLY' ? 3 : contract.billing_cycle === 'ANNUAL' ? 12 : 1

  // Build draft invoice
  const today = new Date().toISOString().slice(0, 10)
  const due = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

  const { data: invoice, error: invErr } = await admin
    .from('invoices')
    .insert({
      org_id: dbUser.org_id,
      customer_id: contract.customer_id,
      source: 'CONTRACT_RMR',
      source_contract_id: id,
      issued_at: today,
      due_date: due,
      payment_terms_days: 30,
      notes: `${contract.contract_number}: ${contract.name} — ${contract.billing_cycle} billing`,
      created_by: dbUser.id,
    })
    .select()
    .single()

  if (invErr || !invoice) return NextResponse.json({ error: invErr?.message ?? 'Insert failed' }, { status: 500 })

  let subtotal = 0
  const lineRows = lines.map(l => {
    const amount = Number(l.monthly_amount ?? 0) * mult
    subtotal += amount
    return {
      invoice_id: invoice.id,
      org_id: dbUser.org_id,
      description: l.description,
      quantity: 1,
      unit_price: +amount.toFixed(2),
      source_type: 'RMR' as const,
    }
  })

  await admin.from('invoice_line_items').insert(lineRows)

  await admin
    .from('invoices')
    .update({ subtotal: +subtotal.toFixed(2), updated_at: new Date().toISOString() })
    .eq('id', invoice.id)

  // Advance next_bill_date and stamp last_billed_at
  const nextBill = contract.next_bill_date
    ? advanceDate(contract.next_bill_date, contract.billing_cycle)
    : advanceDate(today, contract.billing_cycle)

  await admin
    .from('service_contracts')
    .update({
      next_bill_date: nextBill,
      last_billed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('org_id', dbUser.org_id)

  await admin.from('contract_events').insert({
    contract_id: id,
    org_id: dbUser.org_id,
    event_type: 'BILLED',
    details: { invoice_id: invoice.id, amount: +subtotal.toFixed(2), cycle: contract.billing_cycle },
    created_by: dbUser.id,
  })

  return NextResponse.json({ ...invoice, subtotal: +subtotal.toFixed(2) }, { status: 201 })
}
