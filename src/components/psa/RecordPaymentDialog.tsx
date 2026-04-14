'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { PAYMENT_METHODS, type PaymentMethod } from '@/types/database'

export function RecordPaymentDialog({
  invoiceId,
  balance,
  open,
  onClose,
  onRecorded,
}: {
  invoiceId: string
  balance: number
  open: boolean
  onClose: () => void
  onRecorded: () => void
}) {
  const [amount, setAmount] = useState(balance.toFixed(2))
  const [method, setMethod] = useState<PaymentMethod>('CHECK')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  async function submit() {
    const amt = Number(amount)
    if (!amt || amt <= 0) {
      setError('Amount must be greater than 0')
      return
    }
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/org/psa/invoices/${invoiceId}/payments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        amount: amt,
        method,
        reference_number: reference || null,
        notes: notes || null,
      }),
    })
    setBusy(false)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setError(err.error ?? 'Failed to record payment')
      return
    }
    onRecorded()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">Record Payment</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Amount (Balance: ${balance.toFixed(2)})
            </label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Method</label>
            <select
              value={method}
              onChange={e => setMethod(e.target.value as PaymentMethod)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Reference #</label>
            <input
              value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder="Check #, transaction ID, etc"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          {error && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500">
              {error}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? 'Recording…' : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>
  )
}
