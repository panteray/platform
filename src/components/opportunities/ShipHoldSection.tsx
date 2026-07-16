'use client'

import { useState } from 'react'
import type { Opportunity } from '@/types/database'
import { OppStatus } from '@/types/enums'

interface Props {
  opp: Opportunity
  onUpdate: (updated: Opportunity) => void
}

export function ShipHoldSection({ opp, onUpdate }: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const status = opp.status as OppStatus
  if (status !== OppStatus.ORDER_ENTRY && status !== OppStatus.SHIP_HOLD) return null

  async function toggle(action: 'place' | 'clear') {
    setSaving(true); setError(null)
    const res = await fetch(`/api/org/opportunities/${opp.id}/ship-hold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const result = await res.json(); setSaving(false)
    if (!res.ok) { setError(result.error ?? 'Failed to update ship hold'); return }
    onUpdate({
      ...opp,
      status: result.status,
      ship_hold_cleared_at: action === 'clear' ? new Date().toISOString() : opp.ship_hold_cleared_at,
    })
  }

  const onHold = status === OppStatus.SHIP_HOLD

  return (
    <div className={`rounded-md border p-4 space-y-2 ${onHold ? 'border-amber-500/30 bg-amber-500/10' : 'border-border bg-card'}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Ship Hold</p>
        {onHold && <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-700">On Hold</span>}
      </div>

      {error && <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-500">{error}</div>}

      {opp.ship_hold_cleared_at && (
        <p className="text-xs text-muted-foreground">Last cleared: {new Date(opp.ship_hold_cleared_at).toLocaleString()}</p>
      )}

      <div className="flex justify-end">
        {onHold ? (
          <button
            onClick={() => toggle('clear')}
            disabled={saving}
            className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? 'Clearing...' : 'Clear Ship Hold'}
          </button>
        ) : (
          <button
            onClick={() => toggle('place')}
            disabled={saving}
            className="h-8 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 text-sm font-medium text-amber-700 hover:bg-amber-500/20 disabled:opacity-50"
          >
            {saving ? 'Placing...' : 'Place on Ship Hold'}
          </button>
        )}
      </div>
    </div>
  )
}
