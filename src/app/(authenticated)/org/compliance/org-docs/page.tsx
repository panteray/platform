'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Plus, X, ShieldCheck, ShieldAlert, Clock, Trash2, ExternalLink, FileText } from 'lucide-react'

interface OrgDoc {
  id: string
  doc_type: string
  policy_number: string | null
  carrier: string | null
  coverage_limit: number | null
  effective_date: string | null
  expiration_date: string | null
  audit_due_date: string | null
  document_url: string | null
  notes: string | null
  status: 'active' | 'expired' | 'pending' | 'cancelled'
  created_at: string
}

const DOC_TYPES: { value: string; label: string; group: 'insurance' | 'ul' | 'other' }[] = [
  { value: 'GENERAL_LIABILITY', label: 'General Liability', group: 'insurance' },
  { value: 'WORKERS_COMP',      label: 'Workers Comp',       group: 'insurance' },
  { value: 'EO_INSURANCE',      label: 'Errors & Omissions', group: 'insurance' },
  { value: 'CYBER_LIABILITY',   label: 'Cyber Liability',    group: 'insurance' },
  { value: 'AUTO_INSURANCE',    label: 'Auto Insurance',     group: 'insurance' },
  { value: 'UMBRELLA',          label: 'Umbrella',           group: 'insurance' },
  { value: 'BOND',              label: 'Surety Bond',        group: 'insurance' },
  { value: 'UL_827',            label: 'UL 827 (Central Station)', group: 'ul' },
  { value: 'UL_2050',           label: 'UL 2050 (National Industrial Security)', group: 'ul' },
  { value: 'UL_294',            label: 'UL 294 (Access Control)', group: 'ul' },
  { value: 'UL_10C',            label: 'UL 10C (Fire Door)', group: 'ul' },
  { value: 'OTHER',             label: 'Other',              group: 'other' },
]

function labelForType(t: string): string {
  return DOC_TYPES.find(d => d.value === t)?.label || t
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.floor((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function ExpiryBadge({ doc }: { doc: OrgDoc }) {
  if (doc.status !== 'active') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
        {doc.status}
      </span>
    )
  }
  const days = daysUntil(doc.expiration_date)
  if (days === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
        <ShieldCheck className="h-3 w-3" /> Active
      </span>
    )
  }
  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-800">
        <ShieldAlert className="h-3 w-3" /> Expired {Math.abs(days)}d
      </span>
    )
  }
  if (days <= 30) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-800">
        <Clock className="h-3 w-3" /> {days}d
      </span>
    )
  }
  if (days <= 90) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
        <Clock className="h-3 w-3" /> {days}d
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
      <ShieldCheck className="h-3 w-3" /> {days}d
    </span>
  )
}

function formatCurrency(n: number | null): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function OrgComplianceDocsPage() {
  const [docs, setDocs] = useState<OrgDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    doc_type: 'GENERAL_LIABILITY',
    policy_number: '',
    carrier: '',
    coverage_limit: '',
    effective_date: '',
    expiration_date: '',
    audit_due_date: '',
    document_url: '',
    notes: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/org/compliance/org-docs')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setDocs(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleCreate() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/org/compliance/org-docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          coverage_limit: form.coverage_limit ? parseFloat(form.coverage_limit) : null,
          effective_date: form.effective_date || null,
          expiration_date: form.expiration_date || null,
          audit_due_date: form.audit_due_date || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown' }))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      setForm({
        doc_type: 'GENERAL_LIABILITY',
        policy_number: '', carrier: '', coverage_limit: '',
        effective_date: '', expiration_date: '', audit_due_date: '',
        document_url: '', notes: '',
      })
      setShowCreate(false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this compliance document?')) return
    const res = await fetch(`/api/org/compliance/org-docs/${id}`, { method: 'DELETE' })
    if (res.ok) setDocs(prev => prev.filter(d => d.id !== id))
  }

  // Summary stats
  const stats = useMemo(() => {
    const active = docs.filter(d => d.status === 'active')
    const expiring30 = active.filter(d => {
      const days = daysUntil(d.expiration_date)
      return days !== null && days >= 0 && days <= 30
    })
    const expired = active.filter(d => {
      const days = daysUntil(d.expiration_date)
      return days !== null && days < 0
    })
    return { total: docs.length, active: active.length, expiring30: expiring30.length, expired: expired.length }
  }, [docs])

  // Group by category
  const grouped = useMemo(() => {
    const byGroup: Record<string, OrgDoc[]> = { insurance: [], ul: [], other: [] }
    for (const d of docs) {
      const g = DOC_TYPES.find(t => t.value === d.doc_type)?.group || 'other'
      byGroup[g].push(d)
    }
    return byGroup
  }, [docs])

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Org Compliance Docs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Insurance policies, UL certifications, bonds. Tracks expiration and audit due dates.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Add Document
        </button>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-4 gap-3">
        <StatCard label="Total Docs"    value={stats.total}      color="slate" />
        <StatCard label="Active"        value={stats.active}     color="emerald" />
        <StatCard label="Expiring 30d"  value={stats.expiring30} color="amber" />
        <StatCard label="Expired"       value={stats.expired}    color="rose" />
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="mb-6 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">New Compliance Document</h2>
            <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <LabelField label="Document Type">
              <select
                value={form.doc_type}
                onChange={e => setForm(f => ({ ...f, doc_type: e.target.value }))}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              >
                <optgroup label="Insurance">
                  {DOC_TYPES.filter(t => t.group === 'insurance').map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </optgroup>
                <optgroup label="UL Certification">
                  {DOC_TYPES.filter(t => t.group === 'ul').map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Other">
                  {DOC_TYPES.filter(t => t.group === 'other').map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </optgroup>
              </select>
            </LabelField>
            <LabelField label="Carrier / Issuer">
              <input
                value={form.carrier}
                onChange={e => setForm(f => ({ ...f, carrier: e.target.value }))}
                placeholder="e.g. Travelers, UL LLC"
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              />
            </LabelField>
            <LabelField label="Policy / Certificate Number">
              <input
                value={form.policy_number}
                onChange={e => setForm(f => ({ ...f, policy_number: e.target.value }))}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              />
            </LabelField>
            <LabelField label="Coverage Limit (USD)">
              <input
                type="number"
                value={form.coverage_limit}
                onChange={e => setForm(f => ({ ...f, coverage_limit: e.target.value }))}
                placeholder="1000000"
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              />
            </LabelField>
            <LabelField label="Effective Date">
              <input
                type="date"
                value={form.effective_date}
                onChange={e => setForm(f => ({ ...f, effective_date: e.target.value }))}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              />
            </LabelField>
            <LabelField label="Expiration Date">
              <input
                type="date"
                value={form.expiration_date}
                onChange={e => setForm(f => ({ ...f, expiration_date: e.target.value }))}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              />
            </LabelField>
            <LabelField label="Audit Due Date (UL only)">
              <input
                type="date"
                value={form.audit_due_date}
                onChange={e => setForm(f => ({ ...f, audit_due_date: e.target.value }))}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              />
            </LabelField>
            <LabelField label="Document URL">
              <input
                value={form.document_url}
                onChange={e => setForm(f => ({ ...f, document_url: e.target.value }))}
                placeholder="https://..."
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              />
            </LabelField>
          </div>
          <div className="mt-3">
            <LabelField label="Notes">
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm resize-none"
              />
            </LabelField>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleCreate}
              disabled={submitting}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Document'}
            </button>
            <button onClick={() => setShowCreate(false)} className="text-sm text-muted-foreground">Cancel</button>
          </div>
        </div>
      )}

      {/* Docs grouped */}
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading...</div>
      ) : docs.length === 0 ? (
        <div className="py-12 text-center">
          <FileText className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No compliance documents on file</p>
          <p className="mt-1 text-xs text-muted-foreground/60">Add insurance policies and UL certifications to track expiration</p>
        </div>
      ) : (
        <div className="space-y-6">
          <DocSection title="Insurance" docs={grouped.insurance} onDelete={handleDelete} />
          <DocSection title="UL Certifications" docs={grouped.ul} onDelete={handleDelete} />
          <DocSection title="Other" docs={grouped.other} onDelete={handleDelete} />
        </div>
      )}
    </div>
  )
}

function LabelField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: 'slate' | 'emerald' | 'amber' | 'rose' }) {
  const colorMap = {
    slate: 'border-slate-200 bg-slate-50 text-slate-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    rose: 'border-rose-200 bg-rose-50 text-rose-900',
  }
  return (
    <div className={`rounded-lg border p-3 ${colorMap[color]}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  )
}

function DocSection({ title, docs, onDelete }: { title: string; docs: OrgDoc[]; onDelete: (id: string) => void }) {
  if (docs.length === 0) return null
  return (
    <div>
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">{title} ({docs.length})</h2>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Type</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Carrier</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Policy #</th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Limit</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Expires</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {docs.map(d => (
              <tr key={d.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2 font-medium">{labelForType(d.doc_type)}</td>
                <td className="px-3 py-2 text-muted-foreground">{d.carrier || '—'}</td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{d.policy_number || '—'}</td>
                <td className="px-3 py-2 text-right font-mono">{formatCurrency(d.coverage_limit)}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {d.expiration_date ? new Date(d.expiration_date).toLocaleDateString() : '—'}
                </td>
                <td className="px-3 py-2"><ExpiryBadge doc={d} /></td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {d.document_url && (
                      <a
                        href={d.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Open document"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <button
                      onClick={() => onDelete(d.id)}
                      className="rounded p-1 text-muted-foreground hover:bg-rose-50 hover:text-rose-600"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
