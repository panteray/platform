'use client'

import { useState } from 'react'
import type { Opportunity } from '@/types/database'

interface Props {
  opp: Opportunity
  onUpdate: (updated: Opportunity) => void
}

type Outcome = 'PENDING' | 'WON' | 'LOST'

export function OutcomeSection({ opp, onUpdate }: Props) {
  const currentOutcome: Outcome = (opp.outcome ?? 'PENDING') as Outcome
  const [outcome, setOutcome] = useState<Outcome>(currentOutcome)
  const [lostReason, setLostReason] = useState(opp.lost_reason ?? '')
  const [signedAt, setSignedAt] = useState(opp.payment_agreement_signed_at?.slice(0, 16) ?? '')
  const [terms, setTerms] = useState(opp.payment_terms ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty =
    outcome !== currentOutcome ||
    lostReason !== (opp.lost_reason ?? '') ||
    signedAt !== (opp.payment_agreement_signed_at?.slice(0, 16) ?? '') ||
    terms !== (opp.payment_terms ?? '')

  async function save() {
    setSaving(true); setError(null)
    const payload: Record<string, unknown> = {
      outcome,
      payment_agreement_signed_at: signedAt ? new Date(signedAt).toISOString() : null,
      payment_terms: terms || null,
    }
    if (outcome === 'LOST') payload.lost_reason = lostReason
    const res = await fetch(`/api/org/opportunities/${opp.id}/outcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const result = await res.json(); setSaving(false)
    if (!res.ok) { setError(result.error ?? 'Failed to save outcome'); return }
    onUpdate({
      ...opp,
      outcome,
      lost_reason: outcome === 'LOST' ? lostReason : null,
      payment_agreement_signed_at: signedAt ? new Date(signedAt).toISOString() : null,
      payment_terms: terms || null,
      status: result.status ?? opp.status,
    })
  }

  const ic = 'h-8 w-full rounded-md border border-border bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring'
  const lc = 'block text-[11px] font-medium text-muted-foreground mb-1'
  const tc = 'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-vertical'

  return (
    <div className="rounded-md border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Customer Decision</p>
        {currentOutcome !== 'PENDING' && (
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${currentOutcome === 'WON' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
            {currentOutcome}
          </span>
        )}
      </div>

      {error && <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-500">{error}</div>}

      <div className="flex gap-2">
        {(['PENDING', 'WON', 'LOST'] as Outcome[]).map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => setOutcome(o)}
            className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
              outcome === o
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border bg-background text-muted-foreground hover:text-foreground'
            }`}
          >
            {o}
          </button>
        ))}
      </div>

      {outcome === 'LOST' && (
        <div>
          <label className={lc}>Lost Reason (required)</label>
          <textarea className={tc} rows={2} value={lostReason} onChange={(e) => setLostReason(e.target.value)} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lc}>Payment Agreement Signed</label>
          <input type="datetime-local" className={ic} value={signedAt} onChange={(e) => setSignedAt(e.target.value)} />
        </div>
        <div>
          <label className={lc}>Payment Terms</label>
          <input className={ic} placeholder="e.g. Net 30 / 50-50" value={terms} onChange={(e) => setTerms(e.target.value)} />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={!dirty || saving || (outcome === 'LOST' && !lostReason.trim())}
          className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Saving...' : outcome === 'WON' && currentOutcome !== 'WON' ? 'Mark WON → Order Entry' : outcome === 'LOST' && currentOutcome !== 'LOST' ? 'Mark LOST → Close' : 'Save'}
        </button>
      </div>
    </div>
  )
}
