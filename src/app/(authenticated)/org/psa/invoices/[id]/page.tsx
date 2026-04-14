'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Send, DollarSign, Trash2 } from 'lucide-react'
import type { Invoice, InvoiceLineItem, InvoicePayment, InvoiceStatus } from '@/types/database'
import { InvoiceLineItemEditor } from '@/components/psa/InvoiceLineItemEditor'
import { RecordPaymentDialog } from '@/components/psa/RecordPaymentDialog'

type InvoiceDetail = Invoice & {
  customer: { id: string; name: string } | null
  line_items: InvoiceLineItem[]
  payments: InvoicePayment[]
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

const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params.id
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPayment, setShowPayment] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    fetch(`/api/org/psa/invoices/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setInvoice(d))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>
  if (!invoice) return <div className="p-6 text-sm text-red-500">Invoice not found</div>

  const total = Number(invoice.total ?? 0)
  const paid = Number(invoice.amount_paid ?? 0)
  const balance = total - paid
  const editable = invoice.status === 'DRAFT'

  async function send() {
    setBusy(true)
    const res = await fetch(`/api/org/psa/invoices/${id}/send`, { method: 'POST' })
    setBusy(false)
    if (res.ok) load()
  }

  async function del() {
    if (!confirm('Delete this draft invoice?')) return
    setBusy(true)
    const res = await fetch(`/api/org/psa/invoices/${id}`, { method: 'DELETE' })
    setBusy(false)
    if (res.ok) router.push('/org/psa/invoices')
  }

  return (
    <div className="space-y-6 p-6">
      <Link href="/org/psa/invoices" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to invoices
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold">{invoice.invoice_number}</h1>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[invoice.status]}`}>
              {invoice.status.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {invoice.customer?.name ?? '—'} • Issued {invoice.issued_at} • Due {invoice.due_date}
          </p>
        </div>
        <div className="flex gap-2">
          {editable && (
            <>
              <button
                onClick={send}
                disabled={busy || invoice.line_items.length === 0}
                className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Send className="h-4 w-4" /> Send
              </button>
              <button
                onClick={del}
                disabled={busy}
                className="flex items-center gap-1 rounded-md border border-red-500/30 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            </>
          )}
          {!editable && balance > 0 && invoice.status !== 'VOID' && invoice.status !== 'WRITTEN_OFF' && (
            <button
              onClick={() => setShowPayment(true)}
              className="flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <DollarSign className="h-4 w-4" /> Record Payment
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Subtotal</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{money(Number(invoice.subtotal))}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Tax</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{money(Number(invoice.tax_amount))}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Total</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{money(total)}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Balance</div>
          <div className={`mt-1 text-xl font-semibold tabular-nums ${balance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {money(balance)}
          </div>
        </div>
      </div>

      <InvoiceLineItemEditor
        invoiceId={invoice.id}
        lines={invoice.line_items}
        editable={editable}
        onChange={load}
      />

      {invoice.payments.length > 0 && (
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">Payments</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Method</th>
                <th className="px-4 py-2">Reference</th>
                <th className="px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.payments.map(p => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-2 text-muted-foreground">{new Date(p.paid_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-xs uppercase">{p.method.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-2 text-muted-foreground">{p.reference_number ?? '—'}</td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums">{money(Number(p.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {invoice.notes && (
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</div>
          <p className="mt-1 whitespace-pre-wrap text-sm">{invoice.notes}</p>
        </div>
      )}

      <RecordPaymentDialog
        invoiceId={invoice.id}
        balance={balance}
        open={showPayment}
        onClose={() => setShowPayment(false)}
        onRecorded={load}
      />
    </div>
  )
}
