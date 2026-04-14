'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, FileWarning, CheckCircle2, AlertTriangle } from 'lucide-react'
import type { PsaPriority } from '@/types/database'

type PirData = {
  id: string
  priority: PsaPriority
  pir_completed_at: string | null
  pir_root_cause: string | null
  pir_timeline: string | null
  pir_lessons_learned: string | null
  pir_action_items: string | null
}

/**
 * G7: Post-Incident Report panel.
 *
 * Renders only for P1/P2 tickets. Enforces G10 closeout gate by giving the PM
 * a place to document RCA, timeline, lessons learned, and action items. Marks
 * complete when the PM clicks "Complete PIR" — unblocks COMPLETED → RESOLVED.
 */
export function PirPanel({ ticketId, priority }: { ticketId: string; priority: PsaPriority }) {
  const [data, setData] = useState<PirData | null>(null)
  const [open, setOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Only P1/P2 trigger PIR gate
  const required = priority === 'P1' || priority === 'P2'

  useEffect(() => {
    if (!required) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    fetch(`/api/org/psa/tickets/${ticketId}/pir`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setData(d) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [ticketId, required])

  if (!required || loading || !data) return null

  const complete = !!data.pir_completed_at

  async function save(patch: Partial<PirData> & { complete?: boolean }) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/org/psa/tickets/${ticketId}/pir`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Save failed')
      }
      const updated = await res.json()
      setData((d) => (d ? { ...d, ...updated } : updated))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 hover:bg-neutral-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileWarning className="w-4 h-4 text-neutral-600" />
          <h3 className="text-sm font-semibold text-neutral-900">Post-Incident Report</h3>
          <span className="px-1.5 py-0.5 bg-neutral-100 text-neutral-700 text-[10px] font-mono rounded">
            {priority}
          </span>
          {complete ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold rounded">
              <CheckCircle2 className="w-3 h-3" /> Complete
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold rounded">
              <AlertTriangle className="w-3 h-3" /> Required for closeout
            </span>
          )}
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-neutral-500" /> : <ChevronRight className="w-4 h-4 text-neutral-500" />}
      </button>

      {open && (
        <div className="border-t border-neutral-200 p-3 space-y-3">
          {error && (
            <div className="px-2 py-1.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>
          )}

          <PirField
            label="Root Cause"
            placeholder="What was the underlying cause?"
            value={data.pir_root_cause ?? ''}
            disabled={saving}
            onBlur={(v) => save({ pir_root_cause: v })}
          />
          <PirField
            label="Timeline"
            placeholder="Detection → escalation → containment → resolution (with times)"
            value={data.pir_timeline ?? ''}
            disabled={saving}
            onBlur={(v) => save({ pir_timeline: v })}
          />
          <PirField
            label="Lessons Learned"
            placeholder="What went well, what didn't, what to change"
            value={data.pir_lessons_learned ?? ''}
            disabled={saving}
            onBlur={(v) => save({ pir_lessons_learned: v })}
          />
          <PirField
            label="Action Items"
            placeholder="Preventive actions with owners and due dates"
            value={data.pir_action_items ?? ''}
            disabled={saving}
            onBlur={(v) => save({ pir_action_items: v })}
          />

          <div className="flex items-center justify-between pt-1">
            <div className="text-[11px] text-neutral-500">
              {complete
                ? `Completed ${new Date(data.pir_completed_at!).toLocaleString()}`
                : 'PIR must be marked complete before this P1/P2 ticket can transition to RESOLVED.'}
            </div>
            {complete ? (
              <button
                disabled={saving}
                onClick={() => save({ complete: false })}
                className="px-2 py-1 text-xs border border-neutral-300 rounded hover:bg-neutral-50 disabled:opacity-50"
              >
                Reopen
              </button>
            ) : (
              <button
                disabled={saving}
                onClick={() => save({ complete: true })}
                className="px-3 py-1 text-xs font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
              >
                Mark PIR Complete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function PirField({ label, placeholder, value, disabled, onBlur }: {
  label: string
  placeholder: string
  value: string
  disabled: boolean
  onBlur: (v: string) => void
}) {
  const [local, setLocal] = useState(value)
  useEffect(() => { setLocal(value) }, [value])
  return (
    <div>
      <label className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wide">{label}</label>
      <textarea
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => { if (local !== value) onBlur(local) }}
        placeholder={placeholder}
        disabled={disabled}
        rows={2}
        className="mt-1 w-full text-xs px-2 py-1.5 border border-neutral-200 rounded focus:border-neutral-400 focus:outline-none disabled:bg-neutral-50 resize-y"
      />
    </div>
  )
}
