'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { FileText, AlertCircle, Plus, TrendingUp } from 'lucide-react'
import type { Invoice, InvoiceStatus } from '@/types/database'

type InvoiceRow = Invoice & {
  customer: { id: string; name: string } | null
}

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  DRAFT: 'bg-neutral-200 text-neutral-700',
  SENT: 'bg-blue-100 text-blue-800',
  VIEWED: 'bg-indigo-100 text-indigo-800',
  PARTIAL_PAID: 'bg-amber-100 text-amber-800',
  PAID: 'bg-emerald-100 text-emerald-800',
  OVERDUE: 'bg-red-100 text-red-800',
  VOID: 'bg-neutral-100 text-neutral-500',
  WRITTEN_OFF: 'bg-neutral-100 text-neutral-500',
}

const TABS: Array<InvoiceStatus | 'ALL'> = ['ALL', 'DRAFT', 'SENT', 'PARTIAL_PAID', 'OVERDUE', 'PAID', 'VOID']

const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

export default function InvoicesView() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<InvoiceStatus | 'ALL'>('ALL')

  useEffect(() => {
    fetch('/api/org/psa/invoices')
      .then(r => r.ok ? r.json() : r.json().then(d => { throw new Error(d.error || 'Failed') }))
      .then(d => setInvoices(d))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (tab === 'ALL') return invoices
    return invoices.filter(i => i.status === tab)
  }, [invoices, tab])

  const summary = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    let outstanding = 0
    let overdue = 0
    let drafted = 0
    let paidYtd = 0
    const yearStart = `${new Date().getFullYear()}-01-01`
    for (const i of invoices) {
      const total = Number(i.total ?? 0)
      const paid = Number(i.amount_paid ?? 0)
      const balance = total - paid
      if (i.status === 'DRAFT') drafted += total
      else if (['SENT', 'VIEWED', 'PARTIAL_PAID', 'OVERDUE'].includes(i.status)) {
        outstanding += balance
        if (i.due_date < today) overdue += balance
      } else if (i.status === 'PAID' && i.paid_at && i.paid_at >= yearStart) {
        paidYtd += total
      }
    }
    return { outstanding, overdue, drafted, paidYtd }
  }, [invoices])

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Invoices</h1>
          <p className="text-sm text-muted-foreground">Manage and track customer invoices</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/org/psa/invoices/aging"
            className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            <TrendingUp className="h-4 w-4" /> Aging Report
          </Link>
          <Link
            href="/org/psa/invoices/new"
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New Invoice
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <SummaryCard label="Outstanding" value={money(summary.outstanding)} icon={<FileText className="h-4 w-4" />} />
        <SummaryCard label="Overdue" value={money(summary.overdue)} icon={<AlertCircle className="h-4 w-4" />} tone={summary.overdue > 0 ? 'red' : undefined} />
        <SummaryCard label="Drafted" value={money(summary.drafted)} icon={<FileText className="h-4 w-4" />} />
        <SummaryCard label="Paid YTD" value={money(summary.paidYtd)} icon={<FileText className="h-4 w-4" />} tone="green" />
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative px-4 py-2 text-sm transition-colors ${
              tab === t ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.replace(/_/g, ' ')}
            {tab === t && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
          </button>
        ))}
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {error && <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{error}</div>}

      {!loading && !error && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Issued</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">No invoices</td></tr>
              )}
              {filtered.map(i => {
                const total = Number(i.total ?? 0)
                const paid = Number(i.amount_paid ?? 0)
                const balance = total - paid
                return (
                  <tr key={i.id} className="border-t border-border hover:bg-accent/40">
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link href={`/org/psa/invoices/${i.id}`} className="text-primary hover:underline">{i.invoice_number}</Link>
                    </td>
                    <td className="px-4 py-3">{i.customer?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{i.issued_at}</td>
                    <td className="px-4 py-3 text-muted-foreground">{i.due_date}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(total)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(paid)}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{money(balance)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[i.status]}`}>
                        {i.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone?: 'red' | 'green' }) {
  const toneClass = tone === 'red' ? 'text-red-500' : tone === 'green' ? 'text-emerald-500' : 'text-foreground'
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}{label}
      </div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  )
}
