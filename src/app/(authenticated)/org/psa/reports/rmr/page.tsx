'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { TrendingUp, TrendingDown, Users, AlertTriangle } from 'lucide-react'

type RmrResponse = {
  mrr: number
  arr: number
  active_count: number
  new_mrr_this_month: number
  churned_mrr_this_month: number
  churn_pct: number
  at_risk_count: number
  at_risk: Array<{
    id: string
    name: string
    customer: { id: string; name: string } | null
    end_date: string
    days_until_end: number
    monthly_amount: number
  }>
}

const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

export default function RmrReportPage() {
  const [data, setData] = useState<RmrResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/org/psa/reports/rmr')
      .then(r => r.ok ? r.json() : r.json().then(d => { throw new Error(d.error || 'Failed') }))
      .then(d => setData(d))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>
  if (error) return <div className="p-6 text-sm text-red-500">{error}</div>
  if (!data) return null

  const netNew = data.new_mrr_this_month - data.churned_mrr_this_month

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">RMR Dashboard</h1>
        <p className="text-sm text-muted-foreground">Recurring revenue, churn and at-risk contracts</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card label="MRR" value={money(data.mrr)} icon={<TrendingUp className="h-4 w-4" />} hero />
        <Card label="ARR" value={money(data.arr)} icon={<TrendingUp className="h-4 w-4" />} />
        <Card label="Active Contracts" value={String(data.active_count)} icon={<Users className="h-4 w-4" />} />
        <Card label="At Risk" value={String(data.at_risk_count)} icon={<AlertTriangle className="h-4 w-4" />} tone={data.at_risk_count > 0 ? 'red' : undefined} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card label="New MRR This Month" value={money(data.new_mrr_this_month)} icon={<TrendingUp className="h-4 w-4" />} tone="green" />
        <Card label="Churned MRR This Month" value={money(data.churned_mrr_this_month)} icon={<TrendingDown className="h-4 w-4" />} tone={data.churned_mrr_this_month > 0 ? 'red' : undefined} />
        <Card label="Net New MRR" value={money(netNew)} icon={netNew >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />} tone={netNew >= 0 ? 'green' : 'red'} />
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Churn Rate (this month)</div>
        <div className={`mt-1 text-3xl font-bold tabular-nums ${data.churn_pct > 5 ? 'text-red-500' : data.churn_pct > 2 ? 'text-amber-600' : 'text-emerald-600'}`}>
          {data.churn_pct.toFixed(2)}%
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">At-Risk Contracts (within renewal notice window)</h2>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Contract</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">End Date</th>
                <th className="px-4 py-3 text-right">Days Until End</th>
                <th className="px-4 py-3 text-right">MRR</th>
              </tr>
            </thead>
            <tbody>
              {data.at_risk.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">No at-risk contracts</td></tr>
              )}
              {data.at_risk.map(c => (
                <tr key={c.id} className="border-t border-border hover:bg-accent/40">
                  <td className="px-4 py-3">
                    <Link href={`/org/psa/contracts/${c.id}`} className="text-primary hover:underline">{c.name}</Link>
                  </td>
                  <td className="px-4 py-3">{c.customer?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.end_date}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${c.days_until_end < 7 ? 'font-semibold text-red-500' : 'text-amber-600'}`}>
                    {c.days_until_end}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">{money(c.monthly_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Card({ label, value, icon, hero, tone }: { label: string; value: string; icon: React.ReactNode; hero?: boolean; tone?: 'red' | 'green' }) {
  const toneClass = tone === 'red' ? 'text-red-500' : tone === 'green' ? 'text-emerald-600' : 'text-foreground'
  return (
    <div className={`rounded-lg border border-border bg-card p-4 ${hero ? 'ring-1 ring-primary/30' : ''}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}{label}
      </div>
      <div className={`mt-2 ${hero ? 'text-3xl' : 'text-2xl'} font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  )
}
