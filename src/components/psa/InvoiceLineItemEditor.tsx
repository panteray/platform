'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { InvoiceLineItem, InvoiceLineSource } from '@/types/database'

const SOURCE_TYPES: InvoiceLineSource[] = ['LABOR', 'PARTS', 'RMR', 'FEE', 'OTHER']

export function InvoiceLineItemEditor({
  invoiceId,
  lines,
  editable,
  onChange,
}: {
  invoiceId: string
  lines: InvoiceLineItem[]
  editable: boolean
  onChange: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [desc, setDesc] = useState('')
  const [qty, setQty] = useState('1')
  const [price, setPrice] = useState('0')
  const [sourceType, setSourceType] = useState<InvoiceLineSource>('OTHER')
  const [busy, setBusy] = useState(false)

  async function add() {
    if (!desc.trim()) return
    setBusy(true)
    const res = await fetch(`/api/org/psa/invoices/${invoiceId}/line-items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        description: desc,
        quantity: Number(qty) || 1,
        unit_price: Number(price) || 0,
        source_type: sourceType,
      }),
    })
    setBusy(false)
    if (res.ok) {
      setDesc('')
      setQty('1')
      setPrice('0')
      setSourceType('OTHER')
      setAdding(false)
      onChange()
    }
  }

  async function remove(lineId: string) {
    setBusy(true)
    await fetch(`/api/org/psa/invoices/${invoiceId}/line-items?line_id=${lineId}`, {
      method: 'DELETE',
    })
    setBusy(false)
    onChange()
  }

  const money = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">Line Items</h3>
        {editable && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        )}
      </div>

      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2">Description</th>
            <th className="px-4 py-2 w-20 text-right">Qty</th>
            <th className="px-4 py-2 w-28 text-right">Unit Price</th>
            <th className="px-4 py-2 w-28 text-right">Total</th>
            <th className="px-4 py-2 w-20">Type</th>
            {editable && <th className="px-4 py-2 w-12"></th>}
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 && !adding && (
            <tr>
              <td colSpan={editable ? 6 : 5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                No line items yet
              </td>
            </tr>
          )}
          {lines.map(l => (
            <tr key={l.id} className="border-t border-border">
              <td className="px-4 py-2">{l.description}</td>
              <td className="px-4 py-2 text-right tabular-nums">{Number(l.quantity).toFixed(2)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{money(Number(l.unit_price))}</td>
              <td className="px-4 py-2 text-right font-medium tabular-nums">{money(Number(l.line_total))}</td>
              <td className="px-4 py-2 text-xs uppercase text-muted-foreground">{l.source_type}</td>
              {editable && (
                <td className="px-4 py-2">
                  <button
                    onClick={() => remove(l.id)}
                    disabled={busy}
                    className="text-muted-foreground hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              )}
            </tr>
          ))}
          {adding && (
            <tr className="border-t border-border bg-muted/30">
              <td className="px-4 py-2">
                <input
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  placeholder="Description"
                  className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
                  autoFocus
                />
              </td>
              <td className="px-4 py-2">
                <input
                  type="number"
                  step="0.01"
                  value={qty}
                  onChange={e => setQty(e.target.value)}
                  className="w-full rounded border border-border bg-background px-2 py-1 text-right text-sm"
                />
              </td>
              <td className="px-4 py-2">
                <input
                  type="number"
                  step="0.01"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  className="w-full rounded border border-border bg-background px-2 py-1 text-right text-sm"
                />
              </td>
              <td className="px-4 py-2 text-right text-sm tabular-nums">
                {money((Number(qty) || 0) * (Number(price) || 0))}
              </td>
              <td className="px-4 py-2">
                <select
                  value={sourceType}
                  onChange={e => setSourceType(e.target.value as InvoiceLineSource)}
                  className="w-full rounded border border-border bg-background px-1 py-1 text-xs"
                >
                  {SOURCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </td>
              <td className="px-4 py-2">
                <div className="flex gap-1">
                  <button
                    onClick={add}
                    disabled={busy || !desc.trim()}
                    className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setAdding(false)}
                    className="rounded border border-border px-2 py-1 text-xs"
                  >
                    ✕
                  </button>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
