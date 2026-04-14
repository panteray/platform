import { NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Fetch all contracts
  const { data: contracts, error } = await admin
    .from('service_contracts')
    .select('id, name, status, billing_model, billing_cycle, end_date, renewal_notice_days, customer_id, customer:customers(id, name)')
    .eq('org_id', dbUser.org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const contractIds = (contracts ?? []).map(c => c.id)
  const { data: lines } = contractIds.length
    ? await admin
        .from('contract_line_items')
        .select('contract_id, monthly_amount')
        .in('contract_id', contractIds)
    : { data: [] }

  // Sum monthly per contract
  const monthlyByContract = new Map<string, number>()
  for (const l of lines ?? []) {
    monthlyByContract.set(
      l.contract_id,
      (monthlyByContract.get(l.contract_id) ?? 0) + Number(l.monthly_amount ?? 0)
    )
  }

  let mrr = 0
  let activeCount = 0
  let churnedThisMonth = 0
  let newThisMonth = 0
  const atRisk: Array<Record<string, unknown>> = []

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  for (const c of contracts ?? []) {
    const monthly = monthlyByContract.get(c.id) ?? 0
    if (c.status === 'ACTIVE') {
      mrr += monthly
      activeCount++

      // At risk: end_date within renewal_notice_days
      if (c.end_date) {
        const end = new Date(c.end_date)
        const days = Math.floor((end.getTime() - now.getTime()) / 86400000)
        if (days <= (c.renewal_notice_days ?? 30) && days >= 0) {
          atRisk.push({
            id: c.id,
            name: c.name,
            customer: Array.isArray(c.customer) ? c.customer[0] : c.customer,
            end_date: c.end_date,
            days_until_end: days,
            monthly_amount: monthly,
          })
        }
      }
    }
  }

  // Churn this month: contracts cancelled this month (from events)
  const { data: cancelEvents } = await admin
    .from('contract_events')
    .select('contract_id, created_at')
    .eq('org_id', dbUser.org_id)
    .eq('event_type', 'CANCELLED')
    .gte('created_at', monthStart.toISOString())

  const cancelledIds = new Set((cancelEvents ?? []).map(e => e.contract_id))
  for (const cid of cancelledIds) {
    churnedThisMonth += monthlyByContract.get(cid) ?? 0
  }

  // New this month: contracts created this month
  const { data: createdEvents } = await admin
    .from('contract_events')
    .select('contract_id, created_at')
    .eq('org_id', dbUser.org_id)
    .eq('event_type', 'CREATED')
    .gte('created_at', monthStart.toISOString())

  const newIds = new Set((createdEvents ?? []).map(e => e.contract_id))
  for (const cid of newIds) {
    newThisMonth += monthlyByContract.get(cid) ?? 0
  }

  const arr = mrr * 12
  const churnPct = mrr > 0 ? +((churnedThisMonth / mrr) * 100).toFixed(2) : 0

  return NextResponse.json({
    mrr: +mrr.toFixed(2),
    arr: +arr.toFixed(2),
    active_count: activeCount,
    new_mrr_this_month: +newThisMonth.toFixed(2),
    churned_mrr_this_month: +churnedThisMonth.toFixed(2),
    churn_pct: churnPct,
    at_risk_count: atRisk.length,
    at_risk: atRisk,
  })
}
