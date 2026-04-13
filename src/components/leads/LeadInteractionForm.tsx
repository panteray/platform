'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { InteractionType, InteractionDirection } from '@/types/enums'

interface LeadInteractionFormProps {
  leadId: string
  onSaved: () => void
  onCancel: () => void
}

const TYPES = Object.values(InteractionType)
const DIRECTIONS = Object.values(InteractionDirection)

export function LeadInteractionForm({ leadId, onSaved, onCancel }: LeadInteractionFormProps) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    type: 'NOTE' as string,
    direction: '' as string,
    subject: '',
    body: '',
    outcome: '',
    interaction_date: new Date().toISOString().slice(0, 16),
    duration_minutes: '',
    follow_up_date: '',
    follow_up_note: '',
  })

  function set(key: string, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch(`/api/org/leads/${leadId}/interactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        direction: form.direction || null,
        duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes, 10) : null,
        follow_up_date: form.follow_up_date || null,
        follow_up_note: form.follow_up_note || null,
      }),
    })
    setSaving(false)
    if (res.ok) onSaved()
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold">Log Interaction</h4>
        <button type="button" onClick={onCancel} className="rounded p-1 hover:bg-muted">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Type *</label>
          <select
            value={form.type}
            onChange={(e) => set('type', e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Direction</label>
          <select
            value={form.direction}
            onChange={(e) => set('direction', e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="">—</option>
            {DIRECTIONS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Date/Time</label>
          <input
            type="datetime-local"
            value={form.interaction_date}
            onChange={(e) => set('interaction_date', e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Duration (min)</label>
          <input
            type="number"
            value={form.duration_minutes}
            onChange={(e) => set('duration_minutes', e.target.value)}
            placeholder="e.g. 30"
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Subject</label>
          <input
            value={form.subject}
            onChange={(e) => set('subject', e.target.value)}
            placeholder="Brief subject line"
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes</label>
          <textarea
            value={form.body}
            onChange={(e) => set('body', e.target.value)}
            rows={3}
            placeholder="Details of the interaction..."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Outcome</label>
          <input
            value={form.outcome}
            onChange={(e) => set('outcome', e.target.value)}
            placeholder="What was the result?"
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          />
        </div>

        {/* Follow-up */}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Follow-up Date</label>
          <input
            type="date"
            value={form.follow_up_date}
            onChange={(e) => set('follow_up_date', e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Follow-up Note</label>
          <input
            value={form.follow_up_note}
            onChange={(e) => set('follow_up_note', e.target.value)}
            placeholder="What to follow up on"
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-9 rounded-md border border-border px-4 text-sm hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Log Interaction'}
        </button>
      </div>
    </form>
  )
}
