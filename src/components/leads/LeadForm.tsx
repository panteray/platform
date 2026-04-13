'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { LeadSource, LeadPriority } from '@/types/enums'
import { US_STATES } from '@/types/enums'

interface LeadFormProps {
  onSave: (data: Record<string, unknown>) => void
  onCancel: () => void
  saving: boolean
}

const SOURCES = Object.values(LeadSource)
const PRIORITIES = Object.values(LeadPriority)
const VERTICALS = ['K12', 'HED', 'GOV', 'BIZ', 'MED']

export function LeadForm({ onSave, onCancel, saving }: LeadFormProps) {
  const [form, setForm] = useState({
    contact_first_name: '',
    contact_last_name: '',
    company_name: '',
    contact_title: '',
    contact_email: '',
    contact_phone: '',
    contact_mobile: '',
    source: '' as string,
    source_detail: '',
    priority: 'WARM',
    vertical: '' as string,
    address: '',
    city: '',
    state: '' as string,
    zip: '',
    primary_website: '',
    estimated_value: '',
    referred_by: '',
    pain_points: '',
    notes: '',
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.contact_first_name.trim() || !form.contact_last_name.trim()) return
    onSave({
      ...form,
      estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : null,
      source: form.source || null,
      vertical: form.vertical || null,
      state: form.state || null,
    })
  }

  function set(key: string, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }))
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">New Lead</h3>
        <button type="button" onClick={onCancel} className="rounded p-1 hover:bg-muted">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Contact */}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">First Name *</label>
          <input
            required
            value={form.contact_first_name}
            onChange={(e) => set('contact_first_name', e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Last Name *</label>
          <input
            required
            value={form.contact_last_name}
            onChange={(e) => set('contact_last_name', e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Company</label>
          <input
            value={form.company_name}
            onChange={(e) => set('company_name', e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Title</label>
          <input
            value={form.contact_title}
            onChange={(e) => set('contact_title', e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Email</label>
          <input
            type="email"
            value={form.contact_email}
            onChange={(e) => set('contact_email', e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Phone</label>
          <input
            value={form.contact_phone}
            onChange={(e) => set('contact_phone', e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Source & Priority */}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Source</label>
          <select
            value={form.source}
            onChange={(e) => set('source', e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Select...</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Priority</label>
          <select
            value={form.priority}
            onChange={(e) => set('priority', e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Vertical</label>
          <select
            value={form.vertical}
            onChange={(e) => set('vertical', e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Select...</option>
            {VERTICALS.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        {/* Location */}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Address</label>
          <input
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">City</label>
          <input
            value={form.city}
            onChange={(e) => set('city', e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">State</label>
            <select
              value={form.state}
              onChange={(e) => set('state', e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">—</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">ZIP</label>
            <input
              value={form.zip}
              onChange={(e) => set('zip', e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        {/* Value */}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Est. Value ($)</label>
          <input
            type="number"
            step="0.01"
            value={form.estimated_value}
            onChange={(e) => set('estimated_value', e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Referred By</label>
          <input
            value={form.referred_by}
            onChange={(e) => set('referred_by', e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Website</label>
          <input
            value={form.primary_website}
            onChange={(e) => set('primary_website', e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="mt-3">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes</label>
        <textarea
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={2}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
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
          {saving ? 'Creating...' : 'Create Lead'}
        </button>
      </div>
    </form>
  )
}
