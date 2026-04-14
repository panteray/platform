'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Package, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import type { InventoryTxn } from '@/types/database'

interface Props { projectId: string }

export function ProjectInventoryTab({ projectId }: Props) {
  const [txns, setTxns] = useState<(InventoryTxn & { user?: { first_name: string; last_name: string } | null })[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    item_description: '',
    part_number: '',
    type: 'DEBIT' as 'DEBIT' | 'CREDIT',
    quantity: '1',
    notes: '',
  })

  const load = useCallback(async () => {
    const res = await fetch(`/api/org/projects/${projectId}/inventory`)
    if (res.ok) setTxns(await res.json())
    setLoading(false)
  }, [projectId])

  useEffect(() => { load() }, [load])

  const handleSubmit = async () => {
    if (!form.item_description.trim()) return
    const res = await fetch(`/api/org/projects/${projectId}/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_description: form.item_description.trim(),
        part_number: form.part_number || null,
        type: form.type,
        quantity: parseInt(form.quantity) || 1,
        notes: form.notes || null,
      }),
    })
    if (res.ok) {
      setShowForm(false)
      setForm({ item_description: '', part_number: '', type: 'DEBIT', quantity: '1', notes: '' })
      await load()
    }
  }

  // Running balance per item
  const balanceMap: Record<string, number> = {}
  for (const txn of [...txns].reverse()) {
    const key = txn.item_description.toLowerCase()
    if (!balanceMap[key]) balanceMap[key] = 0
    balanceMap[key] += txn.type === 'DEBIT' ? -txn.quantity : txn.quantity
  }

  if (loading) return <div className="flex h-32 items-center justify-center"><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Van Stock / Inventory</h3>
          <p className="text-[10px] text-muted-foreground">Append-only ledger · {txns.length} transactions</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-3 w-3" /> Log Transaction
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Item Description *</label>
              <input value={form.item_description} onChange={e => setForm({ ...form, item_description: e.target.value })} placeholder="e.g. Axis M3015 camera" className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Part Number</label>
              <input value={form.part_number} onChange={e => setForm({ ...form, part_number: e.target.value })} className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Type</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as 'DEBIT' | 'CREDIT' })} className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary">
                <option value="DEBIT">DEBIT (issue to job)</option>
                <option value="CREDIT">CREDIT (return)</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Quantity</label>
              <input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} min={1} className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Notes</label>
              <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSubmit} disabled={!form.item_description.trim()} className="rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">Log</button>
            <button onClick={() => setShowForm(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
        </div>
      )}

      {/* Ledger */}
      {txns.length === 0 && !showForm ? (
        <div className="flex flex-col items-center py-8 text-muted-foreground">
          <Package className="mb-2 h-6 w-6 text-muted-foreground/40" />
          <p className="text-xs">No inventory transactions</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-2.5 py-2 text-left font-semibold">Date</th>
                <th className="px-2.5 py-2 text-left font-semibold">Type</th>
                <th className="px-2.5 py-2 text-left font-semibold">Item</th>
                <th className="px-2.5 py-2 text-left font-semibold">Part #</th>
                <th className="px-2.5 py-2 text-right font-semibold">Qty</th>
                <th className="px-2.5 py-2 text-left font-semibold">By</th>
                <th className="px-2.5 py-2 text-left font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody>
              {txns.map(txn => (
                <tr key={txn.id} className="border-b border-border hover:bg-accent/30">
                  <td className="px-2.5 py-2 text-muted-foreground">
                    {new Date(txn.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-2.5 py-2">
                    {txn.type === 'DEBIT' ? (
                      <span className="inline-flex items-center gap-0.5 text-red-600 font-bold">
                        <ArrowDownCircle className="h-3 w-3" /> DEBIT
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-emerald-600 font-bold">
                        <ArrowUpCircle className="h-3 w-3" /> CREDIT
                      </span>
                    )}
                  </td>
                  <td className="px-2.5 py-2 text-foreground">{txn.item_description}</td>
                  <td className="px-2.5 py-2 text-muted-foreground font-mono text-[10px]">{txn.part_number ?? '—'}</td>
                  <td className="px-2.5 py-2 text-right font-medium text-foreground">{txn.quantity}</td>
                  <td className="px-2.5 py-2 text-muted-foreground">
                    {txn.user ? `${txn.user.first_name} ${txn.user.last_name}` : '—'}
                  </td>
                  <td className="px-2.5 py-2 text-muted-foreground truncate max-w-[120px]">{txn.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
