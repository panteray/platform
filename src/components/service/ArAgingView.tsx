'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, Clock } from 'lucide-react'

type Bucket = { count: number; amount: number }
type ArAgingResponse = {
  buckets: {
    current: Bucket
    d_30: Bucket
    d_60: Bucket
    d_90: Bucket
    d_90_plus: Bucket
  }
  total_ar: number
  dso: number | null
  rows: Array<{
    id: string
    invoice_number: string
    customer: { id: string; name: string } | null
    due_date: string
    total: number
    amount_paid: number
    status: string
    days_overdue: number
    balance: number
  }>
}

const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

export default function ArAgingView() {
  const [data, setData] = useState<ArAgingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/org/psa/reports/ar-aging')
      .then(r => r.ok ? r.json() : r.json().then(d => { throw new Error(d.error || 'Failed') }))
      .then(d => setData(d))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>
  if (error) return <div className="p-6 text-sm text-red-500">{error}</div>
  if (!data) return null

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">AR Aging</h1>
        <p className="text-sm text-muted-foreground">Outstanding receivables by age bucket</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <BucketCard label="Current" bucket={data.buckets.current} tone="green" />
        <BucketCard label="1-30 days" bucket={data.buckets.d_30} tone="amber" />
        <BucketCard label="31-60 days" bucket={data.buckets.d_60} tone="orange" />
        <BucketCard label="61-90 days" bucket={data.buckets.d_90} tone="red" />
        <BucketCard label="90+ days" bucket={data.buckets.d_90_plus} tone="red" />
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Clock className="h-4 w-4" /> DSO
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{data.dso ?? '—'}</div>
          <div className="mt-1 text-xs text-muted-foreground">Days sales outstanding</div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Total Outstanding</div>
        <div className="mt-1 text-3xl font-bold tabular-nums">{money(data.total_ar)}</div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3 text-right">Days Overdue</th>
              <th className="px-4 py-3 text-right">Balance</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">No outstanding invoices</td></tr>
            )}
            {data.rows.map(r => (
              <tr key={r.id} className="border-t border-border hover:bg-accent/40">
                <td className="px-4 py-3 font-mono text-xs">
                  <Link href={`/org/psa/invoices/${r.id}`} className="text-primary hover:underline">{r.invoice_number}</Link>
                </td>
                <td className="px-4 py-3">{r.customer?.name ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.due_date}</td>
                <td className={`px-4 py-3 text-right tabular-nums ${r.days_overdue > 60 ? 'font-semibold text-red-500' : r.days_overdue > 0 ? 'text-amber-600' : ''}`}>
                  {r.days_overdue}
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">{money(r.balance)}</td>
                <td className="px-4 py-3 text-xs">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BucketCard({ label, bucket, tone }: { label: string; bucket: Bucket; tone: 'green' | 'amber' | 'orange' | 'red' }) {
  const toneClass = {
    green: 'text-emerald-600',
    amber: 'text-amber-600',
    orange: 'text-orange-600',
    red: 'text-red-500',
  }[tone]
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-2 text-xl font-semibold tabular-nums ${toneClass}`}>{money(bucket.amount)}</div>
      <div className="mt-1 text-xs text-muted-foreground">{bucket.count} invoice{bucket.count === 1 ? '' : 's'}</div>
    </div>
  )
}
