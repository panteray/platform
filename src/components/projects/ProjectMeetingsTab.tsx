'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, CheckCircle2, Link2, Users } from 'lucide-react'
import type { MeetingMinutes, MeetingAttendee, MeetingActionItem, MeetingDecision } from '@/types/database'

interface Props {
  projectId: string
}

const MEETING_TYPE_LABELS: Record<MeetingMinutes['meeting_type'], string> = {
  ikom: 'Internal Kickoff (IKOM)',
  ckom: 'Customer Kickoff (CKOM)',
  status: 'Status',
  closeout: 'Closeout',
  ad_hoc: 'Ad Hoc',
}

interface FormState {
  meeting_type: MeetingMinutes['meeting_type']
  title: string
  meeting_date: string
  location: string
  agenda: string
  discussion_notes: string
  next_meeting_date: string
  attendees: MeetingAttendee[]
  action_items: MeetingActionItem[]
  decisions: MeetingDecision[]
}

const emptyForm: FormState = {
  meeting_type: 'status',
  title: '',
  meeting_date: '',
  location: '',
  agenda: '',
  discussion_notes: '',
  next_meeting_date: '',
  attendees: [],
  action_items: [],
  decisions: [],
}

const ic = 'h-8 w-full rounded-md border border-border bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring'
const lc = 'block text-[11px] font-medium text-muted-foreground mb-1'
const tc = 'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-vertical'
const smallBtn = 'inline-flex items-center gap-1 h-7 rounded-md border border-border px-2 text-xs text-muted-foreground hover:bg-muted'

function TypeBadge({ type }: { type: MeetingMinutes['meeting_type'] }) {
  const cls =
    type === 'ikom' ? 'bg-violet-500/15 text-violet-700'
    : type === 'ckom' ? 'bg-blue-500/15 text-blue-700'
    : type === 'closeout' ? 'bg-orange-500/15 text-orange-700'
    : 'bg-muted text-muted-foreground'
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${cls}`}>{MEETING_TYPE_LABELS[type]}</span>
}

export function ProjectMeetingsTab({ projectId }: Props) {
  const [meetings, setMeetings] = useState<MeetingMinutes[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [portalLink, setPortalLink] = useState<{ meetingId: string; url: string } | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/org/projects/${projectId}/meetings`)
    if (res.ok) setMeetings(await res.json())
    setLoading(false)
  }, [projectId])

  useEffect(() => { load() }, [load])

  function startNew() {
    setForm({ ...emptyForm, meeting_date: new Date().toISOString().slice(0, 16) })
    setEditingId('new')
    setError(null)
  }

  function startEdit(m: MeetingMinutes) {
    setForm({
      meeting_type: m.meeting_type,
      title: m.title,
      meeting_date: m.meeting_date?.slice(0, 16) ?? '',
      location: m.location ?? '',
      agenda: m.agenda ?? '',
      discussion_notes: m.discussion_notes ?? '',
      next_meeting_date: m.next_meeting_date?.slice(0, 16) ?? '',
      attendees: m.attendees ?? [],
      action_items: m.action_items ?? [],
      decisions: m.decisions ?? [],
    })
    setEditingId(m.id)
    setError(null)
  }

  async function save() {
    if (!form.title.trim()) { setError('Title is required'); return }
    setSaving(true); setError(null)
    const payload = {
      ...form,
      meeting_date: form.meeting_date ? new Date(form.meeting_date).toISOString() : new Date().toISOString(),
      next_meeting_date: form.next_meeting_date ? new Date(form.next_meeting_date).toISOString() : null,
    }
    const url = editingId === 'new'
      ? `/api/org/projects/${projectId}/meetings`
      : `/api/org/projects/${projectId}/meetings/${editingId}`
    const res = await fetch(url, {
      method: editingId === 'new' ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (!res.ok) { setError((await res.json()).error ?? 'Failed to save meeting'); return }
    setEditingId(null); setForm(emptyForm)
    load()
  }

  async function markHeld(m: MeetingMinutes) {
    setError(null)
    const res = await fetch(`/api/org/projects/${projectId}/meetings/${m.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mark_held: true }),
    })
    if (!res.ok) { setError((await res.json()).error ?? 'Failed to mark held'); return }
    load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this meeting?')) return
    const res = await fetch(`/api/org/projects/${projectId}/meetings/${id}`, { method: 'DELETE' })
    if (!res.ok) { setError((await res.json()).error ?? 'Failed to delete'); return }
    load()
  }

  async function createPortalLink(m: MeetingMinutes) {
    setError(null)
    const res = await fetch(`/api/org/projects/${projectId}/meetings/${m.id}/portal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (!res.ok) { setError((await res.json()).error ?? 'Failed to create portal link'); return }
    const tokenRow = await res.json()
    const url = `${window.location.origin}/portal/kickoff/${tokenRow.token}`
    setPortalLink({ meetingId: m.id, url })
    try { await navigator.clipboard.writeText(url) } catch {}
  }

  // list editors -------------------------------------------------------------
  function updateAttendee(i: number, patch: Partial<MeetingAttendee>) {
    setForm((f) => ({ ...f, attendees: f.attendees.map((a, idx) => idx === i ? { ...a, ...patch } : a) }))
  }
  function updateActionItem(i: number, patch: Partial<MeetingActionItem>) {
    setForm((f) => ({ ...f, action_items: f.action_items.map((a, idx) => idx === i ? { ...a, ...patch } : a) }))
  }
  function updateDecision(i: number, patch: Partial<MeetingDecision>) {
    setForm((f) => ({ ...f, decisions: f.decisions.map((d, idx) => idx === i ? { ...d, ...patch } : d) }))
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading meetings...</p>

  return (
    <div className="space-y-4">
      {error && <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{error}</div>}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">Meetings</h2>
        </div>
        {editingId === null && (
          <button onClick={startNew} className="inline-flex items-center gap-1.5 h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-3.5 w-3.5" /> New Meeting
          </button>
        )}
      </div>

      {editingId !== null && (
        <div className="rounded-md border border-border bg-card p-4 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {editingId === 'new' ? 'New Meeting' : 'Edit Meeting'}
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div><label className={lc}>Type</label>
              <select className={ic} value={form.meeting_type} onChange={(e) => setForm((f) => ({ ...f, meeting_type: e.target.value as FormState['meeting_type'] }))}>
                {(Object.keys(MEETING_TYPE_LABELS) as FormState['meeting_type'][]).map((t) => <option key={t} value={t}>{MEETING_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div><label className={lc}>Title *</label><input className={ic} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></div>
            <div><label className={lc}>Date &amp; Time</label><input type="datetime-local" className={ic} value={form.meeting_date} onChange={(e) => setForm((f) => ({ ...f, meeting_date: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lc}>Location</label><input className={ic} value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} /></div>
            <div><label className={lc}>Next Meeting</label><input type="datetime-local" className={ic} value={form.next_meeting_date} onChange={(e) => setForm((f) => ({ ...f, next_meeting_date: e.target.value }))} /></div>
          </div>
          <div><label className={lc}>Agenda</label><textarea className={tc} rows={2} value={form.agenda} onChange={(e) => setForm((f) => ({ ...f, agenda: e.target.value }))} /></div>
          <div><label className={lc}>Discussion Notes</label><textarea className={tc} rows={3} value={form.discussion_notes} onChange={(e) => setForm((f) => ({ ...f, discussion_notes: e.target.value }))} /></div>

          {/* Attendees */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className={lc}>Attendees</label>
              <button type="button" onClick={() => setForm((f) => ({ ...f, attendees: [...f.attendees, { name: '', role: '', present: true }] }))} className={smallBtn}><Plus className="h-3 w-3" /> Add</button>
            </div>
            {form.attendees.map((a, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-2">
                <input className={ic} placeholder="Name" value={a.name} onChange={(e) => updateAttendee(i, { name: e.target.value })} />
                <input className={ic} placeholder="Role" value={a.role ?? ''} onChange={(e) => updateAttendee(i, { role: e.target.value })} />
                <label className="flex items-center gap-1 text-xs text-muted-foreground"><input type="checkbox" checked={a.present ?? true} onChange={(e) => updateAttendee(i, { present: e.target.checked })} /> Present</label>
                <button type="button" onClick={() => setForm((f) => ({ ...f, attendees: f.attendees.filter((_, idx) => idx !== i) }))} className={smallBtn}><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
          </div>

          {/* Action items */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className={lc}>Action Items</label>
              <button type="button" onClick={() => setForm((f) => ({ ...f, action_items: [...f.action_items, { description: '', assigned_to: '', due_date: '', status: 'open' }] }))} className={smallBtn}><Plus className="h-3 w-3" /> Add</button>
            </div>
            {form.action_items.map((a, i) => (
              <div key={i} className="grid grid-cols-[2fr_1fr_auto_auto_auto] items-center gap-2">
                <input className={ic} placeholder="Description" value={a.description} onChange={(e) => updateActionItem(i, { description: e.target.value })} />
                <input className={ic} placeholder="Assigned to" value={a.assigned_to ?? ''} onChange={(e) => updateActionItem(i, { assigned_to: e.target.value })} />
                <input type="date" className={ic} value={a.due_date ?? ''} onChange={(e) => updateActionItem(i, { due_date: e.target.value })} />
                <select className={ic} value={a.status ?? 'open'} onChange={(e) => updateActionItem(i, { status: e.target.value })}>
                  <option value="open">Open</option><option value="in_progress">In Progress</option><option value="done">Done</option>
                </select>
                <button type="button" onClick={() => setForm((f) => ({ ...f, action_items: f.action_items.filter((_, idx) => idx !== i) }))} className={smallBtn}><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
          </div>

          {/* Decisions */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className={lc}>Decisions</label>
              <button type="button" onClick={() => setForm((f) => ({ ...f, decisions: [...f.decisions, { description: '', decided_by: '', rationale: '' }] }))} className={smallBtn}><Plus className="h-3 w-3" /> Add</button>
            </div>
            {form.decisions.map((d, i) => (
              <div key={i} className="grid grid-cols-[2fr_1fr_2fr_auto] items-center gap-2">
                <input className={ic} placeholder="Decision" value={d.description} onChange={(e) => updateDecision(i, { description: e.target.value })} />
                <input className={ic} placeholder="Decided by" value={d.decided_by ?? ''} onChange={(e) => updateDecision(i, { decided_by: e.target.value })} />
                <input className={ic} placeholder="Rationale" value={d.rationale ?? ''} onChange={(e) => updateDecision(i, { rationale: e.target.value })} />
                <button type="button" onClick={() => setForm((f) => ({ ...f, decisions: f.decisions.filter((_, idx) => idx !== i) }))} className={smallBtn}><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => { setEditingId(null); setForm(emptyForm); setError(null) }} className="h-8 rounded-md border border-border px-3 text-sm text-muted-foreground hover:bg-muted">Cancel</button>
            <button onClick={save} disabled={saving} className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Meeting'}
            </button>
          </div>
        </div>
      )}

      {meetings.length === 0 && editingId === null ? (
        <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">No meetings yet.</div>
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => (
            <div key={m.id} className="rounded-md border border-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <TypeBadge type={m.meeting_type} />
                  <span className="text-sm font-medium">{m.title}</span>
                  <span className="text-xs text-muted-foreground">{new Date(m.meeting_date).toLocaleString()}</span>
                  {m.held_at && <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700">Held</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  {!m.held_at && (
                    <button onClick={() => markHeld(m)} className="inline-flex items-center gap-1 h-7 rounded-md bg-emerald-600 px-2.5 text-xs font-medium text-white hover:bg-emerald-700">
                      <CheckCircle2 className="h-3 w-3" /> Mark Held
                    </button>
                  )}
                  {m.meeting_type === 'ckom' && (
                    <button onClick={() => createPortalLink(m)} className={smallBtn} title="Create customer portal link">
                      <Link2 className="h-3 w-3" /> Customer Link
                    </button>
                  )}
                  <button onClick={() => startEdit(m)} className={smallBtn}>Edit</button>
                  <button onClick={() => remove(m.id)} className={smallBtn} title="Delete"><Trash2 className="h-3 w-3" /></button>
                </div>
              </div>
              {portalLink?.meetingId === m.id && (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-2 text-xs">
                  <span className="font-medium">Customer link (copied):</span>{' '}
                  <span className="font-mono break-all">{portalLink.url}</span>
                </div>
              )}
              {m.location && <p className="text-xs text-muted-foreground">Location: {m.location}</p>}
              {m.agenda && <p className="text-xs text-muted-foreground whitespace-pre-wrap"><span className="font-medium">Agenda:</span> {m.agenda}</p>}
              {(m.attendees?.length ?? 0) > 0 && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Attendees:</span> {m.attendees.map((a) => a.name).filter(Boolean).join(', ')}
                </p>
              )}
              {(m.action_items?.length ?? 0) > 0 && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Action items:</span>
                  <ul className="ml-4 list-disc">
                    {m.action_items.map((a, i) => (
                      <li key={i}>{a.description}{a.assigned_to ? ` — ${a.assigned_to}` : ''}{a.due_date ? ` (due ${a.due_date})` : ''}{a.status ? ` [${a.status}]` : ''}</li>
                    ))}
                  </ul>
                </div>
              )}
              {(m.decisions?.length ?? 0) > 0 && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Decisions:</span>
                  <ul className="ml-4 list-disc">
                    {m.decisions.map((d, i) => (
                      <li key={i}>{d.description}{d.decided_by ? ` — ${d.decided_by}` : ''}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
