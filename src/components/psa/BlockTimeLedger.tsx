'use client'

import { useState } from 'react'
import { Clock } from 'lucide-react'
import type { ContractEvent, ServiceContract } from '@/types/database'

export function BlockTimeLedger({
  contract,
  events,
  onDebited,
}: {
  contract: ServiceContract
  events: ContractEvent[]
  onDebited: () => void
}) {
  const [hours, setHours] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  if (contract.billing_model !== 'BLOCK_TIME') return null

  const total = Number(contract.block_hours_total ?? 0)
  const used = Number(contract.block_hours_used ?? 0)
  const remaining = total - used
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0
  const tone = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'

  const debits = events.filter(e => e.event_type === 'BLOCK_DEBIT')

  async function debit() {
    const h = Number(hours)
    if (!h || h <= 0) return
    setBusy(true)
    const res = await fetch(`/api/org/psa/contracts/${contract.id}/block-time`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hours: h, notes: notes || null }),
    })
    setBusy(false)
    if (res.ok) {
      setHours('')
      setNotes('')
      onDebited()
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Block Time Ledger</h3>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div>
          <div className="mb-2 flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">{used.toFixed(1)} / {total.toFixed(1)} hrs used</span>
            <span className={`font-semibold tabular-nums ${remaining < 0 ? 'text-red-500' : ''}`}>
              {remaining.toFixed(1)} hrs remaining
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className={`h-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Debit Hours</h4>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.25"
              value={hours}
              onChange={e => setHours(e.target.value)}
              placeholder="Hours"
              className="w-24 rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notes"
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <button
              onClick={debit}
              disabled={busy || !hours}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Debit
            </button>
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Recent Activity</h4>
          {debits.length === 0 ? (
            <p className="text-xs text-muted-foreground">No debits yet</p>
          ) : (
            <div className="space-y-1">
              {debits.slice(0, 10).map(e => {
                const d = e.details as Record<string, unknown> | null
                const h = Number(d?.hours ?? 0)
                const note = d?.notes as string | null
                return (
                  <div key={e.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-xs">
                    <div>
                      <span className="font-medium">−{h.toFixed(2)} hrs</span>
                      {note && <span className="ml-2 text-muted-foreground">{note}</span>}
                    </div>
                    <span className="text-muted-foreground">{new Date(e.created_at).toLocaleDateString()}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
