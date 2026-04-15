'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, TrendingUp, AlertCircle } from 'lucide-react'

type Bucket = 'current' | 'b30' | 'b60' | 'b90' | 'b90plus'

interface AgingResponse {
  buckets: Record<Bucket, number>
  total_ar: number
  dso: number | null
  revenue_90d: number
  by_customer: {
    customer_id: string
    customer_name: string
    current: number
    b30: number
    b60: number
    b90: number
    b90plus: number
    total: number
    invoice_count: number
  }[]
  as_of: string
}

const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

const BUCKET_LABELS: Record<Bucket, string> = {
  current: 'Current',
  b30: '1–30 days',
  b60: '31–60 days',
  b90: '61–90 days',
  b90plus: '90+ days',
}

const BUCKET_TONES: Record<Bucket, string> = {
  current: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  b30: 'border-amber-200 bg-amber-50 text-amber-900',
  b60: 'border-orange-200 bg-orange-50 text-orange-900',
  b90: 'border-red-200 bg-red-50 text-red-900',
  b90plus: 'border-red-400 bg-red-100 text-red-900',
}

export default function InvoiceAgingPage() {
  const [data, setData] = useState<AgingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await fetch('/api/org/psa/invoices/aging')
    if (!res.ok) {
      setError((await res.json()).error ?? 'Failed to load aging')
      setLoading(false)
      return
    }
    setData(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function runScan() {
    setScanning(true)
    setScanResult(null)
    const res = await fetch('/api/org/psa/invoices/scan-overdue', { method: 'POST' })
    const result = await res.json()
    setScanning(false)
    if (!res.ok) {
      setScanResult(result.error ?? 'Scan failed')
      return
    }
    setScanResult(`${result.updated} invoice(s) marked overdue`)
    await load()
  }

  return (
    <div className="space-y-6 p-6">
      <Link
        href="/org/psa/invoices"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to invoices
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">AR Aging Report</h1>
          <p className="text-sm text-muted-foreground">
            {data ? `As of ${data.as_of}` : 'Loading…'}
          </p>
        </div>
        <button
          onClick={runScan}
          disabled={scanning}
          className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${scanning ? 'animate-spin' : ''}`} />
          {scanning ? 'Scanning…' : 'Run overdue scan'}
        </button>
      </div>

      {scanResult && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" /> {scanResult}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">
          {error}
        </div>
      )}

      {data && (
        <>
          {/* Top metrics */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Total AR</div>
              <div className="mt-2 text-3xl font-semibold tabular-nums">{money(data.total_ar)}</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                <TrendingUp className="h-3 w-3" /> DSO
              </div>
              <div className="mt-2 text-3xl font-semibold tabular-nums">
                {data.dso !== null ? `${data.dso} days` : '—'}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Based on {money(data.revenue_90d)} paid in last 90 days
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Customers with balance</div>
              <div className="mt-2 text-3xl font-semibold tabular-nums">{data.by_customer.length}</div>
            </div>
          </div>

          {/* Aging buckets */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {(Object.keys(BUCKET_LABELS) as Bucket[]).map(b => (
              <div key={b} className={`rounded-lg border p-4 ${BUCKET_TONES[b]}`}>
                <div className="text-xs font-medium uppercase tracking-wide opacity-80">
                  {BUCKET_LABELS[b]}
                </div>
                <div className="mt-2 text-2xl font-semibold tabular-nums">
                  {money(data.buckets[b])}
                </div>
                <div className="mt-1 text-[10px] opacity-70">
                  {data.total_ar > 0
                    ? `${Math.round((data.buckets[b] / data.total_ar) * 100)}% of AR`
                    : '—'}
                </div>
              </div>
            ))}
          </div>

          {/* Per-customer */}
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="border-b border-border bg-muted/40 px-4 py-3">
              <h3 className="text-sm font-semibold">By Customer</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2">Customer</th>
                  <th className="px-4 py-2 text-right">Current</th>
                  <th className="px-4 py-2 text-right">1–30</th>
                  <th className="px-4 py-2 text-right">31–60</th>
                  <th className="px-4 py-2 text-right">61–90</th>
                  <th className="px-4 py-2 text-right">90+</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2 text-right"># Inv</th>
                </tr>
              </thead>
              <tbody>
                {data.by_customer.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      No outstanding balances
                    </td>
                  </tr>
                )}
                {data.by_customer.map(row => (
                  <tr key={row.customer_id} className="border-t border-border hover:bg-accent/40">
                    <td className="px-4 py-3">
                      <Link
                        href={`/org/customers/${row.customer_id}`}
                        className="text-primary hover:underline"
                      >
                        {row.customer_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {row.current > 0 ? money(row.current) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-amber-700">
                      {row.b30 > 0 ? money(row.b30) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-orange-700">
                      {row.b60 > 0 ? money(row.b60) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-700">
                      {row.b90 > 0 ? money(row.b90) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-red-800">
                      {row.b90plus > 0 ? money(row.b90plus) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {money(row.total)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {row.invoice_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {loading && !data && (
        <div className="text-sm text-muted-foreground">Loading aging data…</div>
      )}
    </div>
  )
}
