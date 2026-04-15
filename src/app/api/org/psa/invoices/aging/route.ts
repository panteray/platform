import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/org/psa/invoices/aging
 * Returns AR aging buckets (Current, 1-30, 31-60, 61-90, 90+),
 * DSO metric, and per-customer breakdown.
 */
export async function GET(_req: NextRequest) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const OPEN_STATUSES = ['SENT', 'VIEWED', 'PARTIAL_PAID', 'OVERDUE']
  const { data: open, error } = await admin
    .from('invoices')
    .select('id, invoice_number, customer_id, total, amount_paid, due_date, status, customer:customers(id, name)')
    .eq('org_id', dbUser.org_id)
    .in('status', OPEN_STATUSES)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  type Bucket = 'current' | 'b30' | 'b60' | 'b90' | 'b90plus'
  const buckets: Record<Bucket, number> = { current: 0, b30: 0, b60: 0, b90: 0, b90plus: 0 }
  const perCustomer = new Map<string, {
    customer_id: string
    customer_name: string
    current: number
    b30: number
    b60: number
    b90: number
    b90plus: number
    total: number
    invoice_count: number
  }>()

  function bucketFor(daysPastDue: number): Bucket {
    if (daysPastDue <= 0) return 'current'
    if (daysPastDue <= 30) return 'b30'
    if (daysPastDue <= 60) return 'b60'
    if (daysPastDue <= 90) return 'b90'
    return 'b90plus'
  }

  let totalAR = 0
  for (const inv of open ?? []) {
    const balance = Number(inv.total ?? 0) - Number(inv.amount_paid ?? 0)
    if (balance <= 0) continue
    const due = new Date(inv.due_date + 'T00:00:00')
    const daysPastDue = Math.floor((today.getTime() - due.getTime()) / 86400000)
    const b = bucketFor(daysPastDue)
    buckets[b] += balance
    totalAR += balance

    const custRaw = inv.customer as unknown as { id: string; name: string } | { id: string; name: string }[] | null
    const cust = Array.isArray(custRaw) ? custRaw[0] : custRaw
    const cid = inv.customer_id
    const cname = cust?.name ?? '—'
    if (!perCustomer.has(cid)) {
      perCustomer.set(cid, {
        customer_id: cid, customer_name: cname,
        current: 0, b30: 0, b60: 0, b90: 0, b90plus: 0, total: 0, invoice_count: 0,
      })
    }
    const row = perCustomer.get(cid)!
    row[b] += balance
    row.total += balance
    row.invoice_count += 1
  }

  // DSO = (AR / revenue past 90 days) * 90
  const ninetyDaysAgo = new Date(today)
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const { data: recentPaid } = await admin
    .from('invoices')
    .select('total, paid_at')
    .eq('org_id', dbUser.org_id)
    .eq('status', 'PAID')
    .gte('paid_at', ninetyDaysAgo.toISOString())

  const revenue90 = (recentPaid ?? []).reduce((sum, r) => sum + Number(r.total ?? 0), 0)
  const dso = revenue90 > 0 ? Math.round((totalAR / revenue90) * 90) : null

  const byCustomer = Array.from(perCustomer.values()).sort((a, b) => b.total - a.total)

  return NextResponse.json({
    buckets,
    total_ar: totalAR,
    dso,
    revenue_90d: revenue90,
    by_customer: byCustomer,
    as_of: today.toISOString().slice(0, 10),
  })
}
