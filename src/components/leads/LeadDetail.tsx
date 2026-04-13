'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Trash2, ChevronRight, UserCheck } from 'lucide-react'
import { LeadStatusBadge } from './LeadStatusBadge'
import { LeadPriorityBadge } from './LeadPriorityBadge'
import { LeadActivityTimeline } from './LeadActivityTimeline'
import { LeadConvertDialog } from './LeadConvertDialog'
import { LeadStatus, LeadSource, LeadPriority, LeadArchiveReason, LEAD_STATUS_TRANSITIONS, US_STATES } from '@/types/enums'
import type { Lead } from '@/types/database'

interface LeadDetailProps {
  leadId: string
}

const SOURCES = Object.values(LeadSource)
const PRIORITIES = Object.values(LeadPriority)
const ARCHIVE_REASONS = Object.values(LeadArchiveReason)
const VERTICALS = ['K12', 'HED', 'GOV', 'BIZ', 'MED']

const STATUS_LABELS: Record<string, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  QUALIFYING: 'Qualifying',
  QUALIFIED: 'Qualified',
  CONVERTED: 'Converted',
  ARCHIVED: 'Archived',
}

export function LeadDetail({ leadId }: LeadDetailProps) {
  const router = useRouter()
  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [archiveReason, setArchiveReason] = useState('')
  const [showConvertDialog, setShowConvertDialog] = useState(false)

  const fetchLead = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/org/leads/${leadId}`)
    if (!res.ok) {
      setLoading(false)
      return
    }
    const data = await res.json()
    setLead(data)
    setForm(data)
    setLoading(false)
  }, [leadId])

  useEffect(() => {
    fetchLead()
  }, [fetchLead])

  async function handleSave() {
    setSaving(true)
    const res = await fetch(`/api/org/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const updated = await res.json()
      setLead(updated)
      setForm(updated)
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm('Delete this lead? This cannot be undone.')) return
    const res = await fetch(`/api/org/leads/${leadId}`, { method: 'DELETE' })
    if (res.ok) router.push('/org/leads')
  }

  async function handleTransition(newStatus: string) {
    if (newStatus === 'ARCHIVED') {
      setShowArchiveModal(true)
      return
    }
    const res = await fetch('/api/org/leads/transition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: leadId, status: newStatus }),
    })
    if (res.ok) {
      const updated = await res.json()
      setLead(updated)
      setForm(updated)
    }
  }

  async function handleArchive() {
    if (!archiveReason) return
    const res = await fetch('/api/org/leads/transition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: leadId, status: 'ARCHIVED', archive_reason: archiveReason }),
    })
    if (res.ok) {
      const updated = await res.json()
      setLead(updated)
      setForm(updated)
      setShowArchiveModal(false)
      setArchiveReason('')
    }
  }

  function set(key: string, val: unknown) {
    setForm((prev) => ({ ...prev, [key]: val }))
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading lead...</p>
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">Lead not found.</p>
      </div>
    )
  }

  const isConverted = lead.status === LeadStatus.CONVERTED
  const allowedTransitions = LEAD_STATUS_TRANSITIONS[lead.status as LeadStatus] ?? []

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <button
            onClick={() => router.push('/org/leads')}
            className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Back to Leads
          </button>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold tracking-tight">
              {lead.contact_first_name} {lead.contact_last_name}
            </h1>
            <span className="font-mono text-sm text-muted-foreground">{lead.lead_number}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <LeadStatusBadge status={lead.status} />
            <LeadPriorityBadge priority={lead.priority} />
            {lead.company_name && (
              <span className="text-sm text-muted-foreground">{lead.company_name}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDelete}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm text-red-500 hover:bg-red-500/10"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
          {lead.status === LeadStatus.QUALIFIED && (
            <button
              onClick={() => setShowConvertDialog(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <UserCheck className="h-4 w-4" /> Convert
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || isConverted}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Status transitions */}
      {allowedTransitions.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
          <span className="text-xs font-medium text-muted-foreground">Move to:</span>
          {allowedTransitions.map((s) => (
            <button
              key={s}
              onClick={() => handleTransition(s)}
              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              {STATUS_LABELS[s] ?? s}
              <ChevronRight className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}

      {isConverted && lead.converted_customer_id && (
        <div className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
          <p className="text-sm text-emerald-600">
            This lead was converted on {lead.converted_at ? new Date(lead.converted_at).toLocaleDateString() : '—'}.
            {lead.converted_customer_id && (
              <> Customer ID: <span className="font-mono">{lead.converted_customer_id}</span></>
            )}
          </p>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left — Contact & Company */}
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">Contact Information</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="First Name" value={form.contact_first_name as string} onChange={(v) => set('contact_first_name', v)} disabled={isConverted} />
              <Field label="Last Name" value={form.contact_last_name as string} onChange={(v) => set('contact_last_name', v)} disabled={isConverted} />
              <Field label="Title" value={form.contact_title as string} onChange={(v) => set('contact_title', v)} disabled={isConverted} />
              <Field label="Email" value={form.contact_email as string} onChange={(v) => set('contact_email', v)} disabled={isConverted} type="email" />
              <Field label="Phone" value={form.contact_phone as string} onChange={(v) => set('contact_phone', v)} disabled={isConverted} />
              <Field label="Mobile" value={form.contact_mobile as string} onChange={(v) => set('contact_mobile', v)} disabled={isConverted} />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">Company & Location</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Company" value={form.company_name as string} onChange={(v) => set('company_name', v)} disabled={isConverted} />
              <Field label="Website" value={form.primary_website as string} onChange={(v) => set('primary_website', v)} disabled={isConverted} />
              <div className="col-span-2">
                <Field label="Address" value={form.address as string} onChange={(v) => set('address', v)} disabled={isConverted} />
              </div>
              <Field label="City" value={form.city as string} onChange={(v) => set('city', v)} disabled={isConverted} />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">State</label>
                  <select
                    value={(form.state as string) ?? ''}
                    onChange={(e) => set('state', e.target.value || null)}
                    disabled={isConverted}
                    className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm disabled:opacity-50"
                  >
                    <option value="">—</option>
                    {US_STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <Field label="ZIP" value={form.zip as string} onChange={(v) => set('zip', v)} disabled={isConverted} />
              </div>
            </div>
          </div>
        </div>

        {/* Right — Lead Details */}
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">Lead Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Source</label>
                <select
                  value={(form.source as string) ?? ''}
                  onChange={(e) => set('source', e.target.value || null)}
                  disabled={isConverted}
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm disabled:opacity-50"
                >
                  <option value="">—</option>
                  {SOURCES.map((s) => (
                    <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <Field label="Source Detail" value={form.source_detail as string} onChange={(v) => set('source_detail', v)} disabled={isConverted} />
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Priority</label>
                <select
                  value={(form.priority as string) ?? 'WARM'}
                  onChange={(e) => set('priority', e.target.value)}
                  disabled={isConverted}
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm disabled:opacity-50"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Vertical</label>
                <select
                  value={(form.vertical as string) ?? ''}
                  onChange={(e) => set('vertical', e.target.value || null)}
                  disabled={isConverted}
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm disabled:opacity-50"
                >
                  <option value="">—</option>
                  {VERTICALS.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <Field label="Est. Value ($)" value={form.estimated_value != null ? String(form.estimated_value) : ''} onChange={(v) => set('estimated_value', v ? parseFloat(v) : null)} disabled={isConverted} type="number" />
              <Field label="Score (0-100)" value={form.score != null ? String(form.score) : ''} onChange={(v) => set('score', v ? parseInt(v, 10) : null)} disabled={isConverted} type="number" />
              <Field label="Referred By" value={form.referred_by as string} onChange={(v) => set('referred_by', v)} disabled={isConverted} />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">Notes</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Pain Points</label>
                <textarea
                  value={(form.pain_points as string) ?? ''}
                  onChange={(e) => set('pain_points', e.target.value)}
                  disabled={isConverted}
                  rows={2}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes</label>
                <textarea
                  value={(form.notes as string) ?? ''}
                  onChange={(e) => set('notes', e.target.value)}
                  disabled={isConverted}
                  rows={3}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">Metadata</h3>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>Created: {new Date(lead.created_at).toLocaleDateString()}</div>
              <div>Updated: {new Date(lead.updated_at).toLocaleDateString()}</div>
              {lead.assigned_to && <div className="col-span-2">Assigned to: <span className="font-mono">{lead.assigned_to}</span></div>}
            </div>
          </div>

          {/* Activity Timeline */}
          <LeadActivityTimeline leadId={leadId} disabled={isConverted} />
        </div>
      </div>

      {/* Archive Modal */}
      {showArchiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
            <h3 className="mb-3 text-sm font-semibold">Archive Lead</h3>
            <p className="mb-3 text-xs text-muted-foreground">Select a reason for archiving this lead.</p>
            <select
              value={archiveReason}
              onChange={(e) => setArchiveReason(e.target.value)}
              className="mb-4 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="">Select reason...</option>
              {ARCHIVE_REASONS.map((r) => (
                <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowArchiveModal(false); setArchiveReason('') }}
                className="h-9 rounded-md border border-border px-4 text-sm hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleArchive}
                disabled={!archiveReason}
                className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert Dialog */}
      {showConvertDialog && (
        <LeadConvertDialog
          leadId={leadId}
          leadName={`${lead.contact_first_name} ${lead.contact_last_name}`}
          onClose={() => setShowConvertDialog(false)}
          onConverted={fetchLead}
        />
      )}
    </div>
  )
}

/** Reusable inline field */
function Field({
  label,
  value,
  onChange,
  disabled,
  type = 'text',
}: {
  label: string
  value: string | null | undefined
  onChange: (v: string) => void
  disabled: boolean
  type?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  )
}
