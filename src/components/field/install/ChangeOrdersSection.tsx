'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  Camera,
  Check,
  ChevronDown,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import type { ChangeOrder, ChangeOrderPhoto } from '@/types/database'

interface Props {
  projectId: string
}

type CoStatus = ChangeOrder['status']
type CoType = ChangeOrder['type']

const STATUS_LABELS: Record<CoStatus, string> = {
  initiated: 'Initiated',
  classified: 'Classified',
  engineering_delegated: 'Engineering',
  quote_delegated: 'Quoting',
  pm_review: 'PM Review',
  customer_sig: 'Customer Signature',
  injected: 'Injected to scope',
  field_acknowledged: 'Field acknowledged',
  closed: 'Closed',
}

const PIPELINE_STEPS = [
  { key: 'submit',      label: 'Submit',      statuses: ['initiated', 'classified'] as CoStatus[] },
  { key: 'review',      label: 'Review',      statuses: ['engineering_delegated', 'quote_delegated', 'pm_review'] as CoStatus[] },
  { key: 'inject',      label: 'Inject',      statuses: ['customer_sig', 'injected'] as CoStatus[] },
  { key: 'acknowledge', label: 'Acknowledge', statuses: ['field_acknowledged', 'closed'] as CoStatus[] },
] as const

function pipelineStepIndex(status: CoStatus): number {
  return PIPELINE_STEPS.findIndex((s) => (s.statuses as readonly CoStatus[]).includes(status))
}

const CO_TRANSITIONS: Record<CoStatus, CoStatus[]> = {
  initiated: ['classified'],
  classified: ['engineering_delegated', 'quote_delegated', 'pm_review'],
  engineering_delegated: ['quote_delegated', 'pm_review'],
  quote_delegated: ['pm_review'],
  pm_review: ['customer_sig', 'injected', 'closed'],
  customer_sig: ['injected', 'closed'],
  injected: ['field_acknowledged'],
  field_acknowledged: ['closed'],
  closed: [],
}

type FilterMode = 'awaiting' | 'open' | 'all'

export function ChangeOrdersSection({ projectId }: Props) {
  const [cos, setCos] = useState<ChangeOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterMode | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/org/projects/${projectId}/change-orders`)
      if (!res.ok) throw new Error(`Failed to load (${res.status})`)
      const data = (await res.json()) as ChangeOrder[]
      setCos(data)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load change orders')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { void reload() }, [reload])

  const awaitingCount = cos.filter((c) => c.status === 'injected').length
  const openCount = cos.filter((c) => c.status !== 'closed').length
  const totalImpact = cos.reduce((sum, c) => sum + (c.cost_impact ?? 0), 0)

  const effectiveFilter: FilterMode = filter ?? (awaitingCount > 0 ? 'awaiting' : 'open')

  const visible = useMemo(() => {
    if (effectiveFilter === 'awaiting') return cos.filter((c) => c.status === 'injected')
    if (effectiveFilter === 'open') return cos.filter((c) => c.status !== 'closed')
    return cos
  }, [cos, effectiveFilter])

  return (
    <div className="space-y-3 p-4">
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <SummaryStrip openCount={openCount} totalImpact={totalImpact} awaitingCount={awaitingCount} />

      <div className="flex items-center justify-between gap-2">
        <FilterPills value={effectiveFilter} onChange={setFilter} awaitingCount={awaitingCount} />
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:bg-foreground/90"
        >
          <Plus className="h-3.5 w-3.5" />
          New CO
        </button>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
          {cos.length === 0
            ? 'No change orders on this project yet.'
            : 'Nothing matches this filter.'}
        </div>
      ) : (
        visible.map((co) => (
          <CoCard
            key={co.id}
            co={co}
            expanded={expandedId === co.id}
            onToggle={() => setExpandedId(expandedId === co.id ? null : co.id)}
            projectId={projectId}
            onChanged={reload}
            onError={setError}
          />
        ))
      )}

      {showCreate && (
        <CreateModal
          projectId={projectId}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); void reload() }}
          onError={setError}
        />
      )}
    </div>
  )
}

function SummaryStrip({ openCount, totalImpact, awaitingCount }: { openCount: number; totalImpact: number; awaitingCount: number }) {
  return (
    <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card p-3">
      <Metric label="Open" value={String(openCount)} />
      <Metric label="Cost Impact" value={formatMoney(totalImpact)} />
      <Metric label="Awaiting you" value={String(awaitingCount)} accent={awaitingCount > 0 ? 'text-amber-500' : undefined} />
    </div>
  )
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex flex-col items-start">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`mt-0.5 font-mono text-base font-semibold ${accent ?? 'text-foreground'}`}>{value}</span>
    </div>
  )
}

function FilterPills({ value, onChange, awaitingCount }: { value: FilterMode; onChange: (v: FilterMode) => void; awaitingCount: number }) {
  const pills: Array<{ key: FilterMode; label: string; badge?: number }> = [
    { key: 'awaiting', label: 'Awaiting Me', badge: awaitingCount > 0 ? awaitingCount : undefined },
    { key: 'open',     label: 'Open' },
    { key: 'all',      label: 'All' },
  ]
  return (
    <div className="flex items-center gap-1 rounded-full bg-muted p-0.5">
      {pills.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => onChange(p.key)}
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium transition ${
            value === p.key
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {p.label}
          {p.badge != null && (
            <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white">
              {p.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

interface CoCardProps {
  co: ChangeOrder
  expanded: boolean
  projectId: string
  onToggle: () => void
  onChanged: () => Promise<void>
  onError: (message: string | null) => void
}

function CoCard({ co, expanded, projectId, onToggle, onChanged, onError }: CoCardProps) {
  const stepIdx = pipelineStepIndex(co.status)
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <button type="button" onClick={onToggle} className="w-full text-left">
        <div className="flex items-start gap-3 px-4 pt-4 pb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-semibold text-muted-foreground">{co.co_number ?? '—'}</span>
              <TypeBadge type={co.type} />
              {co.status === 'injected' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-3 w-3" />
                  Awaiting acknowledge
                </span>
              )}
            </div>
            <h4 className="mt-1 truncate text-sm font-semibold text-foreground">{co.title}</h4>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="font-mono text-sm font-semibold text-foreground">{formatMoney(co.cost_impact ?? 0)}</span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </div>
        </div>
        <div className="px-4 pb-4">
          <PipelineVisual currentStep={stepIdx} status={co.status} />
        </div>
      </button>

      {expanded && (
        <ExpandedPanel
          co={co}
          projectId={projectId}
          onChanged={onChanged}
          onError={onError}
        />
      )}
    </div>
  )
}

function TypeBadge({ type }: { type: CoType }) {
  const cls = type === 'major'
    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
    : 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
      {type}
    </span>
  )
}

function PipelineVisual({ currentStep, status }: { currentStep: number; status: CoStatus }) {
  return (
    <div className="flex items-center">
      {PIPELINE_STEPS.map((step, idx) => {
        const done = idx < currentStep
        const current = idx === currentStep
        return (
          <div key={step.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                  done
                    ? 'bg-foreground text-background'
                    : current
                      ? 'bg-foreground/10 text-foreground ring-2 ring-foreground'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {done ? <Check className="h-3 w-3" /> : idx + 1}
              </div>
              <span
                className={`mt-1 text-[9px] font-medium ${
                  current ? 'text-foreground' : done ? 'text-foreground/60' : 'text-muted-foreground'
                }`}
              >
                {step.label}
              </span>
              {current && (
                <span className="mt-0.5 max-w-[80px] text-center text-[8px] leading-tight text-muted-foreground">
                  {STATUS_LABELS[status]}
                </span>
              )}
            </div>
            {idx < PIPELINE_STEPS.length - 1 && (
              <div className={`mx-1 h-px flex-1 ${idx < currentStep ? 'bg-foreground' : 'bg-border'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

interface ExpandedProps {
  co: ChangeOrder
  projectId: string
  onChanged: () => Promise<void>
  onError: (message: string | null) => void
}

function ExpandedPanel({ co, projectId, onChanged, onError }: ExpandedProps) {
  const [title, setTitle] = useState(co.title)
  const [description, setDescription] = useState(co.description ?? '')
  const [reason, setReason] = useState(co.reason ?? '')
  const [costImpact, setCostImpact] = useState(String(co.cost_impact ?? 0))
  const [scheduleImpact, setScheduleImpact] = useState(String(co.schedule_impact_days ?? 0))
  const [saving, setSaving] = useState(false)
  const [transitioning, setTransitioning] = useState<CoStatus | null>(null)

  const allowedNext = CO_TRANSITIONS[co.status] ?? []

  async function save() {
    setSaving(true)
    onError(null)
    try {
      const res = await fetch(`/api/org/projects/${projectId}/change-orders?co_id=${co.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          reason: reason.trim() || null,
          cost_impact: Number(costImpact) || 0,
          schedule_impact_days: Number(scheduleImpact) || 0,
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `Save failed (${res.status})`)
      }
      await onChanged()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function transition(next: CoStatus) {
    setTransitioning(next)
    onError(null)
    try {
      const res = await fetch(`/api/org/projects/${projectId}/change-orders?co_id=${co.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `Transition failed (${res.status})`)
      }
      await onChanged()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Transition failed')
    } finally {
      setTransitioning(null)
    }
  }

  return (
    <div className="space-y-4 border-t border-border bg-background/40 p-4">
      {co.status === 'injected' && (
        <button
          type="button"
          onClick={() => transition('field_acknowledged')}
          disabled={transitioning === 'field_acknowledged'}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 disabled:opacity-60"
        >
          {transitioning === 'field_acknowledged' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Acknowledge change order
        </button>
      )}

      <Field label="Title">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
        />
      </Field>

      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
        />
      </Field>

      <Field label="Reason">
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Cost Impact ($)">
          <input
            type="number"
            inputMode="decimal"
            value={costImpact}
            onChange={(e) => setCostImpact(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 font-mono text-sm"
          />
        </Field>
        <Field label="Schedule Impact (days)">
          <input
            type="number"
            inputMode="numeric"
            value={scheduleImpact}
            onChange={(e) => setScheduleImpact(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 font-mono text-sm"
          />
        </Field>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        Save changes
      </button>

      {allowedNext.length > 0 && (
        <div>
          <h5 className="px-1 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Advance status</h5>
          <div className="flex flex-wrap gap-2">
            {allowedNext.map((next) => (
              <button
                key={next}
                type="button"
                onClick={() => transition(next)}
                disabled={transitioning != null}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
              >
                {transitioning === next ? <Loader2 className="h-3 w-3 animate-spin" /> : '→'}
                {STATUS_LABELS[next]}
              </button>
            ))}
          </div>
        </div>
      )}

      <PhotoStrip coId={co.id} projectId={projectId} onError={onError} />
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

interface PhotoStripProps {
  coId: string
  projectId: string
  onError: (message: string | null) => void
}

function PhotoStrip({ coId, projectId, onError }: PhotoStripProps) {
  const [photos, setPhotos] = useState<Array<ChangeOrderPhoto & { url: string | null }>>([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/org/projects/${projectId}/change-orders/${coId}/photos`)
      if (!res.ok) throw new Error(`Failed to load photos (${res.status})`)
      setPhotos(await res.json())
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to load photos')
    }
  }, [coId, projectId, onError])

  useEffect(() => { void load() }, [load])

  async function upload(file: File) {
    setUploading(true)
    onError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`/api/org/projects/${projectId}/change-orders/${coId}/photos`, {
        method: 'POST',
        body: form,
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `Upload failed (${res.status})`)
      }
      await load()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function remove(photoId: string) {
    if (!confirm('Delete this photo?')) return
    onError(null)
    try {
      const res = await fetch(`/api/org/projects/${projectId}/change-orders/${coId}/photos?photo_id=${photoId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `Delete failed (${res.status})`)
      }
      await load()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between pb-2">
        <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Photos ({photos.length})</h5>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-medium hover:bg-muted disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
          Add photo
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f) }}
        />
      </div>
      {photos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-[11px] text-muted-foreground">
          No photos yet
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <div key={p.id} className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
              {p.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.url} alt={p.caption ?? ''} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">missing</div>
              )}
              <button
                type="button"
                onClick={() => remove(p.id)}
                className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface CreateModalProps {
  projectId: string
  onClose: () => void
  onCreated: () => void
  onError: (message: string | null) => void
}

function CreateModal({ projectId, onClose, onCreated, onError }: CreateModalProps) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<CoType>('minor')
  const [description, setDescription] = useState('')
  const [reason, setReason] = useState('')
  const [costImpact, setCostImpact] = useState('')
  const [scheduleImpact, setScheduleImpact] = useState('')
  const [creating, setCreating] = useState(false)

  async function submit() {
    if (!title.trim()) {
      onError('Title is required')
      return
    }
    setCreating(true)
    onError(null)
    try {
      const res = await fetch(`/api/org/projects/${projectId}/change-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          type,
          description: description.trim() || null,
          reason: reason.trim() || null,
          cost_impact: costImpact ? Number(costImpact) : 0,
          schedule_impact_days: scheduleImpact ? Number(scheduleImpact) : 0,
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `Create failed (${res.status})`)
      }
      onCreated()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-card p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">New Change Order</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <Field label="Title">
            <input
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="Brief summary…"
            />
          </Field>
          <Field label="Type">
            <div className="flex gap-2">
              {(['minor', 'major'] as CoType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase ${
                    type === t
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Reason">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cost Impact ($)">
              <input
                type="number"
                inputMode="decimal"
                value={costImpact}
                onChange={(e) => setCostImpact(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm"
                placeholder="0"
              />
            </Field>
            <Field label="Schedule (days)">
              <input
                type="number"
                inputMode="numeric"
                value={scheduleImpact}
                onChange={(e) => setScheduleImpact(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm"
                placeholder="0"
              />
            </Field>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={creating}
            className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-xs font-semibold text-background hover:bg-foreground/90 disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Create
          </button>
        </div>
      </div>
    </div>
  )
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}
