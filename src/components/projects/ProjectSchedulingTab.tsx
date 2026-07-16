'use client'

import { useCallback, useEffect, useState } from 'react'
import { Calendar, CheckCircle2, XCircle, Trash2, Plus } from 'lucide-react'
import type { SchedulingRequest } from '@/types/database'
import { BookingState, BOOKING_STATE_LABELS } from '@/types/enums'

interface Props {
  projectId: string
}

interface NewForm {
  requested_start_date: string
  requested_end_date: string
  cutoff_date: string
  poc_name: string
  poc_email: string
  poc_phone: string
  notes: string
}

const emptyForm: NewForm = {
  requested_start_date: '',
  requested_end_date: '',
  cutoff_date: '',
  poc_name: '',
  poc_email: '',
  poc_phone: '',
  notes: '',
}

const ic = 'h-8 w-full rounded-md border border-border bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring'
const lc = 'block text-[11px] font-medium text-muted-foreground mb-1'
const tc = 'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-vertical'

function StateBadge({ state }: { state: SchedulingRequest['state'] }) {
  const cls =
    state === 'hard_book' ? 'bg-emerald-500/15 text-emerald-700'
    : state === 'cancelled' ? 'bg-red-500/15 text-red-600'
    : 'bg-amber-500/15 text-amber-700'
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${cls}`}>{BOOKING_STATE_LABELS[state as BookingState]}</span>
}

export function ProjectSchedulingTab({ projectId }: Props) {
  const [requests, setRequests] = useState<SchedulingRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState<NewForm>(emptyForm)

  const load = useCallback(async () => {
    const res = await fetch(`/api/org/projects/${projectId}/scheduling`)
    if (res.ok) setRequests(await res.json())
    setLoading(false)
  }, [projectId])

  useEffect(() => { load() }, [load])

  async function create() {
    if (!form.requested_start_date) { setError('Requested start date is required'); return }
    setSaving(true); setError(null)
    const res = await fetch(`/api/org/projects/${projectId}/scheduling`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (!res.ok) { setError((await res.json()).error ?? 'Failed to create request'); return }
    setForm(emptyForm); setShowNew(false)
    load()
  }

  async function transition(reqId: string, newState: BookingState, cancelledReason?: string) {
    setError(null)
    const res = await fetch(`/api/org/projects/${projectId}/scheduling/${reqId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: newState, ...(cancelledReason ? { cancelled_reason: cancelledReason } : {}) }),
    })
    if (!res.ok) { setError((await res.json()).error ?? 'Failed to update'); return }
    load()
  }

  async function remove(reqId: string) {
    if (!confirm('Delete this scheduling request?')) return
    const res = await fetch(`/api/org/projects/${projectId}/scheduling/${reqId}`, { method: 'DELETE' })
    if (!res.ok) { setError((await res.json()).error ?? 'Failed to delete'); return }
    load()
  }

  function cancelWithReason(reqId: string) {
    const reason = prompt('Cancellation reason:')
    if (!reason?.trim()) return
    transition(reqId, BookingState.CANCELLED, reason.trim())
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading scheduling requests...</p>

  return (
    <div className="space-y-4">
      {error && <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{error}</div>}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">Scheduling</h2>
        </div>
        {!showNew && (
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-1.5 h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            New Scheduling Request
          </button>
        )}
      </div>

      {showNew && (
        <div className="rounded-md border border-border bg-card p-4 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">New Scheduling Request (starts as Soft Book)</p>
          <div className="grid grid-cols-3 gap-3">
            <div><label className={lc}>Requested Start *</label><input type="date" className={ic} value={form.requested_start_date} onChange={(e) => setForm((f) => ({ ...f, requested_start_date: e.target.value }))} /></div>
            <div><label className={lc}>Requested End</label><input type="date" className={ic} value={form.requested_end_date} onChange={(e) => setForm((f) => ({ ...f, requested_end_date: e.target.value }))} /></div>
            <div><label className={lc}>Cutoff Date</label><input type="date" className={ic} value={form.cutoff_date} onChange={(e) => setForm((f) => ({ ...f, cutoff_date: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className={lc}>POC Name</label><input className={ic} value={form.poc_name} onChange={(e) => setForm((f) => ({ ...f, poc_name: e.target.value }))} /></div>
            <div><label className={lc}>POC Email</label><input type="email" className={ic} value={form.poc_email} onChange={(e) => setForm((f) => ({ ...f, poc_email: e.target.value }))} /></div>
            <div><label className={lc}>POC Phone</label><input className={ic} value={form.poc_phone} onChange={(e) => setForm((f) => ({ ...f, poc_phone: e.target.value }))} /></div>
          </div>
          <div><label className={lc}>Notes</label><textarea className={tc} rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowNew(false); setForm(emptyForm); setError(null) }} className="h-8 rounded-md border border-border px-3 text-sm text-muted-foreground hover:bg-muted">Cancel</button>
            <button onClick={create} disabled={saving} className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {saving ? 'Saving...' : 'Create Soft Book'}
            </button>
          </div>
        </div>
      )}

      {requests.length === 0 && !showNew ? (
        <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No scheduling requests yet.
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="rounded-md border border-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StateBadge state={r.state} />
                  <span className="text-sm font-medium">
                    {r.state === 'hard_book' && r.confirmed_start_date
                      ? `Confirmed ${r.confirmed_start_date}${r.confirmed_end_date ? ` → ${r.confirmed_end_date}` : ''}`
                      : `Requested ${r.requested_start_date}${r.requested_end_date ? ` → ${r.requested_end_date}` : ''}`}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {r.state === 'soft_book' && (
                    <button
                      onClick={() => transition(r.id, BookingState.HARD_BOOK)}
                      className="inline-flex items-center gap-1 h-7 rounded-md bg-emerald-600 px-2.5 text-xs font-medium text-white hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="h-3 w-3" /> Hard Book
                    </button>
                  )}
                  {r.state !== 'cancelled' && (
                    <button
                      onClick={() => cancelWithReason(r.id)}
                      className="inline-flex items-center gap-1 h-7 rounded-md border border-red-500/50 px-2.5 text-xs font-medium text-red-600 hover:bg-red-500/10"
                    >
                      <XCircle className="h-3 w-3" /> Cancel
                    </button>
                  )}
                  <button
                    onClick={() => remove(r.id)}
                    className="inline-flex items-center h-7 rounded-md border border-border px-2 text-xs text-muted-foreground hover:bg-muted"
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground">
                {r.cutoff_date && <div><span className="font-medium">Cutoff:</span> {r.cutoff_date}</div>}
                {r.poc_name && <div><span className="font-medium">POC:</span> {r.poc_name}{r.poc_phone ? ` (${r.poc_phone})` : ''}</div>}
                {r.poc_email && <div><span className="font-medium">Email:</span> {r.poc_email}</div>}
              </div>
              {r.notes && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{r.notes}</p>}
              {r.cancelled_reason && <p className="text-xs text-red-600"><span className="font-medium">Cancelled:</span> {r.cancelled_reason}</p>}
              {r.hard_booked_at && <p className="text-[11px] text-muted-foreground">Hard-booked {new Date(r.hard_booked_at).toLocaleString()}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
