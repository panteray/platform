'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Package, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import type { InventoryTxn } from '@/types/database'

interface Props { projectId: string }

export function VanStock({ projectId }: Props) {
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

  const submit = async () => {
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

  if (loading) return <div className="flex h-32 items-center justify-center"><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-foreground">Van Stock</h2>
          <p className="text-[10px] text-muted-foreground">{txns.length} transactions</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          <Plus className="h-3 w-3" /> Log
        </button>
      </div>

      {/* Quick Entry */}
      {showForm && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
          <input
            value={form.item_description}
            onChange={e => setForm({ ...form, item_description: e.target.value })}
            placeholder="Item description..."
            className="w-full rounded border border-border bg-background px-2.5 py-2 text-xs outline-none focus:border-primary"
            autoFocus
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              value={form.part_number}
              onChange={e => setForm({ ...form, part_number: e.target.value })}
              placeholder="Part #"
              className="rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
            />
            <select
              value={form.type}
              onChange={e => setForm({ ...form, type: e.target.value as 'DEBIT' | 'CREDIT' })}
              className="rounded border border-border bg-background px-2 py-1.5 text-xs outline-none"
            >
              <option value="DEBIT">DEBIT</option>
              <option value="CREDIT">CREDIT</option>
            </select>
            <input
              type="number"
              value={form.quantity}
              onChange={e => setForm({ ...form, quantity: e.target.value })}
              min={1}
              className="rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={submit} disabled={!form.item_description.trim()} className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">Log</button>
            <button onClick={() => setShowForm(false)} className="text-xs text-muted-foreground">Cancel</button>
          </div>
        </div>
      )}

      {/* Ledger */}
      {txns.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-muted-foreground">
          <Package className="mb-2 h-6 w-6 text-muted-foreground/40" />
          <p className="text-xs">No inventory transactions</p>
        </div>
      ) : (
        <div className="space-y-1">
          {txns.map(txn => (
            <div key={txn.id} className="flex items-center gap-2 rounded-md border border-border px-2.5 py-2">
              {txn.type === 'DEBIT' ? (
                <ArrowDownCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
              ) : (
                <ArrowUpCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{txn.item_description}</p>
                <p className="text-[10px] text-muted-foreground">
                  {txn.part_number && <span className="font-mono">{txn.part_number} · </span>}
                  qty {txn.quantity} · {new Date(txn.created_at).toLocaleDateString()}
                </p>
              </div>
              <span className={`text-[10px] font-bold ${txn.type === 'DEBIT' ? 'text-red-500' : 'text-emerald-500'}`}>
                {txn.type}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
