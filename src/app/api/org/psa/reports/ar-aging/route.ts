import { NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('invoices')
    .select('id, invoice_number, customer_id, customer:customers(id, name), due_date, total, amount_paid, status, issued_at')
    .eq('org_id', dbUser.org_id)
    .not('status', 'in', '(PAID,VOID,WRITTEN_OFF,DRAFT)')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const today = new Date()
  const buckets = {
    current: { count: 0, amount: 0 },
    d_30: { count: 0, amount: 0 },
    d_60: { count: 0, amount: 0 },
    d_90: { count: 0, amount: 0 },
    d_90_plus: { count: 0, amount: 0 },
  }

  type Row = {
    id: string
    invoice_number: string
    customer: { id: string; name: string } | null
    due_date: string
    total: number
    amount_paid: number
    status: string
    issued_at: string
    days_overdue: number
    balance: number
  }
  const rows: Row[] = []

  for (const inv of data ?? []) {
    const balance = Number(inv.total ?? 0) - Number(inv.amount_paid ?? 0)
    if (balance <= 0) continue

    const due = new Date(inv.due_date)
    const daysOverdue = Math.floor((today.getTime() - due.getTime()) / 86400000)

    const customerObj = Array.isArray(inv.customer) ? inv.customer[0] : inv.customer
    rows.push({
      id: inv.id as string,
      invoice_number: inv.invoice_number as string,
      customer: customerObj ?? null,
      due_date: inv.due_date as string,
      total: Number(inv.total ?? 0),
      amount_paid: Number(inv.amount_paid ?? 0),
      status: inv.status as string,
      issued_at: inv.issued_at as string,
      days_overdue: daysOverdue,
      balance,
    })

    if (daysOverdue <= 0) { buckets.current.count++; buckets.current.amount += balance }
    else if (daysOverdue <= 30) { buckets.d_30.count++; buckets.d_30.amount += balance }
    else if (daysOverdue <= 60) { buckets.d_60.count++; buckets.d_60.amount += balance }
    else if (daysOverdue <= 90) { buckets.d_90.count++; buckets.d_90.amount += balance }
    else { buckets.d_90_plus.count++; buckets.d_90_plus.amount += balance }
  }

  // DSO calculation: total AR / (last 90 days revenue / 90)
  const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)
  const { data: paidInvoices } = await admin
    .from('invoices')
    .select('total')
    .eq('org_id', dbUser.org_id)
    .eq('status', 'PAID')
    .gte('issued_at', since)

  const last90Revenue = (paidInvoices ?? []).reduce((s, i) => s + Number(i.total ?? 0), 0)
  const totalAR = rows.reduce((s, r) => s + r.balance, 0)
  const dso = last90Revenue > 0 ? Math.round((totalAR / (last90Revenue / 90)) * 10) / 10 : null

  rows.sort((a, b) => b.days_overdue - a.days_overdue)

  return NextResponse.json({
    buckets,
    total_ar: totalAR,
    dso,
    rows,
  })
}
