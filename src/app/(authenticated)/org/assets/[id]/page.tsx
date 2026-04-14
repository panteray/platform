'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Package, Cpu, Wrench, History, Shield, Plus,
  CheckCircle2,
} from 'lucide-react'
import type {
  Asset, AssetFirmwareHistory, AssetMaintenance, AssetLifecycleEvent,
  AssetStatus, AssetMaintenanceType,
} from '@/types/database'

type AssetDetail = Asset & {
  customer?: { id: string; name: string } | null
  project?: { id: string; pn: string | null; name: string } | null
  install_item?: { id: string; label: string } | null
}

const STATUS_LABELS: Record<AssetStatus, string> = {
  active: 'Active', maintenance: 'Maintenance', retired: 'Retired',
  rma: 'RMA', lost: 'Lost', replaced: 'Replaced',
}

const STATUS_COLORS: Record<AssetStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  maintenance: 'bg-amber-100 text-amber-700',
  retired: 'bg-neutral-100 text-neutral-600',
  rma: 'bg-red-100 text-red-700',
  lost: 'bg-red-100 text-red-700',
  replaced: 'bg-purple-100 text-purple-700',
}

const TABS = ['Overview', 'Firmware', 'Maintenance', 'Lifecycle'] as const
type Tab = (typeof TABS)[number]

export default function AssetDetailPage() {
  const params = useParams<{ id: string }>()
  const [asset, setAsset] = useState<AssetDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('Overview')

  const load = useCallback(async () => {
    if (!params?.id) return
    const res = await fetch(`/api/org/assets/${params.id}`)
    if (res.ok) setAsset(await res.json())
    setLoading(false)
  }, [params?.id])

  useEffect(() => { load() }, [load])

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
  }
  if (!asset) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <p className="text-sm text-muted-foreground">Asset not found.</p>
        <Link href="/org/assets" className="text-sm text-primary hover:underline">Back to assets</Link>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-3 flex items-center gap-2.5 flex-wrap">
        <Link href="/org/assets" className="rounded p-1.5 hover:bg-muted">
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </Link>
        <Package className="h-4 w-4 text-muted-foreground" />
        <span className="text-[13px] text-muted-foreground">Assets</span>
        <span className="text-muted-foreground">/</span>
        <span className="text-base font-semibold text-foreground">{asset.label}</span>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[asset.status]}`}>
          {STATUS_LABELS[asset.status]}
        </span>
        {asset.asset_tag && (
          <span className="text-[11px] font-mono text-muted-foreground">#{asset.asset_tag}</span>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-3 border-b border-border">
        <div className="flex gap-0">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`border-b-2 px-3 py-2 text-[13px] font-medium transition-colors ${
                tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="rounded-lg border border-border bg-card p-4">
        {tab === 'Overview' && <OverviewTab asset={asset} onUpdate={setAsset} />}
        {tab === 'Firmware' && <FirmwareTab assetId={asset.id} />}
        {tab === 'Maintenance' && <MaintenanceTab assetId={asset.id} />}
        {tab === 'Lifecycle' && <LifecycleTab assetId={asset.id} />}
      </div>
    </div>
  )
}

// ============================================================
// Overview Tab
// ============================================================
function OverviewTab({ asset, onUpdate }: { asset: AssetDetail; onUpdate: (a: AssetDetail) => void }) {
  const [editingStatus, setEditingStatus] = useState(false)

  const updateStatus = async (status: AssetStatus) => {
    const res = await fetch(`/api/org/assets/${asset.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      const data = await res.json()
      onUpdate({ ...asset, ...data })
    }
    setEditingStatus(false)
  }

  const warrantyDate = asset.warranty_expires_at ? new Date(asset.warranty_expires_at) : null
  const daysLeft = warrantyDate ? Math.floor((warrantyDate.getTime() - Date.now()) / 86400000) : null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Section title="Identification">
        <Field label="Label" value={asset.label} />
        <Field label="Asset Tag" value={asset.asset_tag} />
        <Field label="Category" value={asset.category} />
        <Field label="Vendor" value={asset.vendor} />
        <Field label="Model" value={asset.model} />
        <Field label="Serial #" value={asset.serial_number} mono />
        <Field label="MAC" value={asset.mac_address} mono />
      </Section>

      <Section title="Status & Lifecycle">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-muted-foreground w-24">Status</span>
          {editingStatus ? (
            <select
              value={asset.status}
              onChange={e => updateStatus(e.target.value as AssetStatus)}
              className="rounded border border-border bg-background px-2 py-0.5 text-[11px]"
              autoFocus
              onBlur={() => setEditingStatus(false)}
            >
              {(Object.keys(STATUS_LABELS) as AssetStatus[]).map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          ) : (
            <button
              onClick={() => setEditingStatus(true)}
              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_COLORS[asset.status]} hover:opacity-80`}
            >
              {STATUS_LABELS[asset.status]}
            </button>
          )}
        </div>
        <Field label="Install Date" value={asset.install_date ? new Date(asset.install_date).toLocaleDateString() : null} />
        <Field label="Warranty Start" value={asset.warranty_start ? new Date(asset.warranty_start).toLocaleDateString() : null} />
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-muted-foreground w-24">Warranty Ends</span>
          {warrantyDate ? (
            <span className={daysLeft !== null && daysLeft < 0 ? 'text-red-600 font-bold' : daysLeft !== null && daysLeft < 90 ? 'text-amber-600 font-bold' : 'text-foreground'}>
              {warrantyDate.toLocaleDateString()}
              {daysLeft !== null && daysLeft < 0 && ' (expired)'}
              {daysLeft !== null && daysLeft >= 0 && daysLeft < 90 && ` (${daysLeft}d left)`}
            </span>
          ) : <span className="text-muted-foreground">—</span>}
        </div>
        <Field label="EOL Date" value={asset.eol_date ? new Date(asset.eol_date).toLocaleDateString() : null} />
      </Section>

      <Section title="Network / State">
        <Field label="Firmware" value={asset.firmware_version} mono />
        <Field label="IP Address" value={asset.ip_address} mono />
        <Field label="Location Notes" value={asset.location_notes} />
      </Section>

      <Section title="Linked Records">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-muted-foreground w-24">Customer</span>
          {asset.customer ? (
            <Link href={`/org/customers/${asset.customer.id}`} className="text-primary hover:underline">
              {asset.customer.name}
            </Link>
          ) : <span className="text-muted-foreground">—</span>}
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-muted-foreground w-24">Project</span>
          {asset.project ? (
            <Link href={`/org/projects/${asset.project.id}`} className="text-primary hover:underline">
              {asset.project.pn ?? asset.project.name}
            </Link>
          ) : <span className="text-muted-foreground">—</span>}
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-muted-foreground w-24">Install Item</span>
          <span className="text-foreground">{asset.install_item?.label ?? '—'}</span>
        </div>
      </Section>

      {asset.notes && (
        <div className="md:col-span-2">
          <Section title="Notes">
            <p className="text-[11px] text-foreground whitespace-pre-wrap">{asset.notes}</p>
          </Section>
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border p-3">
      <h3 className="mb-2 text-[11px] font-bold uppercase text-muted-foreground">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="text-muted-foreground w-24">{label}</span>
      <span className={`text-foreground ${mono ? 'font-mono' : ''}`}>{value ?? <span className="text-muted-foreground">—</span>}</span>
    </div>
  )
}

// ============================================================
// Firmware Tab
// ============================================================
function FirmwareTab({ assetId }: { assetId: string }) {
  const [history, setHistory] = useState<AssetFirmwareHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [version, setVersion] = useState('')
  const [notes, setNotes] = useState('')
  const [cveFixes, setCveFixes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/org/assets/${assetId}/firmware`)
    if (res.ok) setHistory(await res.json())
    setLoading(false)
  }, [assetId])

  useEffect(() => { load() }, [load])

  const submit = async () => {
    if (!version.trim()) return
    setSubmitting(true)
    await fetch(`/api/org/assets/${assetId}/firmware`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version,
        notes: notes || null,
        cve_fixes: cveFixes ? cveFixes.split(',').map(s => s.trim()).filter(Boolean) : null,
      }),
    })
    setVersion(''); setNotes(''); setCveFixes('')
    setShowForm(false)
    setSubmitting(false)
    await load()
  }

  if (loading) return <div className="flex h-32 items-center justify-center"><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold inline-flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5" /> Firmware History
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-3 w-3" /> Log Update
        </button>
      </div>

      {showForm && (
        <div className="mb-3 rounded-md border border-border p-3 space-y-2">
          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Version</label>
            <input
              value={version}
              onChange={e => setVersion(e.target.value)}
              placeholder="e.g. 5.6.20.1"
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs font-mono outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground">CVE Fixes (comma-separated)</label>
            <input
              value={cveFixes}
              onChange={e => setCveFixes(e.target.value)}
              placeholder="CVE-2024-1234, CVE-2024-5678"
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs font-mono outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary resize-none"
            />
          </div>
          <button
            onClick={submit}
            disabled={!version.trim() || submitting}
            className="w-full rounded-md bg-emerald-600 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Save Firmware Update'}
          </button>
        </div>
      )}

      <div className="space-y-1.5">
        {history.map(h => (
          <div key={h.id} className="rounded-md border border-border p-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-foreground">{h.version}</span>
                {h.previous_version && (
                  <span className="text-[10px] text-muted-foreground">from {h.previous_version}</span>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground">{new Date(h.updated_at).toLocaleString()}</span>
            </div>
            {h.cve_fixes && h.cve_fixes.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {h.cve_fixes.map(cve => (
                  <span key={cve} className="rounded bg-red-100 text-red-700 px-1.5 py-0.5 text-[9px] font-mono font-bold">{cve}</span>
                ))}
              </div>
            )}
            {h.notes && <p className="mt-1 text-[10px] text-muted-foreground">{h.notes}</p>}
          </div>
        ))}
        {history.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-6">No firmware updates logged</p>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Maintenance Tab
// ============================================================
const MAINT_TYPES: { value: AssetMaintenanceType; label: string }[] = [
  { value: 'preventive', label: 'Preventive' },
  { value: 'repair', label: 'Repair' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'firmware_update', label: 'Firmware Update' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'calibration', label: 'Calibration' },
]

function MaintenanceTab({ assetId }: { assetId: string }) {
  const [records, setRecords] = useState<AssetMaintenance[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [type, setType] = useState<AssetMaintenanceType>('preventive')
  const [scheduledAt, setScheduledAt] = useState('')
  const [notes, setNotes] = useState('')
  const [cost, setCost] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/org/assets/${assetId}/maintenance`)
    if (res.ok) setRecords(await res.json())
    setLoading(false)
  }, [assetId])

  useEffect(() => { load() }, [load])

  const submit = async () => {
    setSubmitting(true)
    await fetch(`/api/org/assets/${assetId}/maintenance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        scheduled_at: scheduledAt || null,
        technician_notes: notes || null,
        cost: cost ? parseFloat(cost) : null,
      }),
    })
    setScheduledAt(''); setNotes(''); setCost('')
    setShowForm(false)
    setSubmitting(false)
    await load()
  }

  const markComplete = async (mid: string) => {
    await fetch(`/api/org/assets/${assetId}/maintenance`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maintenance_id: mid, completed_at: new Date().toISOString() }),
    })
    await load()
  }

  if (loading) return <div className="flex h-32 items-center justify-center"><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold inline-flex items-center gap-1.5">
          <Wrench className="h-3.5 w-3.5" /> Maintenance
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-3 w-3" /> Schedule
        </button>
      </div>

      {showForm && (
        <div className="mb-3 rounded-md border border-border p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Type</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as AssetMaintenanceType)}
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
              >
                {MAINT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Scheduled</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Cost</label>
            <input
              type="number"
              value={cost}
              onChange={e => setCost(e.target.value)}
              placeholder="0.00"
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary resize-none"
            />
          </div>
          <button
            onClick={submit}
            disabled={submitting}
            className="w-full rounded-md bg-emerald-600 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Schedule Maintenance'}
          </button>
        </div>
      )}

      <div className="space-y-1.5">
        {records.map(r => {
          const isOverdue = r.scheduled_at && !r.completed_at && new Date(r.scheduled_at) < new Date()
          return (
            <div key={r.id} className={`rounded-md border p-2.5 ${isOverdue ? 'border-red-300 bg-red-50' : 'border-border'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground capitalize">{r.type.replace(/_/g, ' ')}</span>
                  {r.completed_at ? (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 text-emerald-700 px-1.5 py-0.5 text-[9px] font-bold">
                      <CheckCircle2 className="h-2.5 w-2.5" /> COMPLETED
                    </span>
                  ) : isOverdue ? (
                    <span className="rounded-full bg-red-100 text-red-700 px-1.5 py-0.5 text-[9px] font-bold">OVERDUE</span>
                  ) : (
                    <span className="rounded-full bg-blue-100 text-blue-700 px-1.5 py-0.5 text-[9px] font-bold">SCHEDULED</span>
                  )}
                </div>
                {!r.completed_at && (
                  <button
                    onClick={() => markComplete(r.id)}
                    className="text-[10px] font-bold text-emerald-600 hover:underline"
                  >
                    Mark Complete
                  </button>
                )}
              </div>
              {r.scheduled_at && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Scheduled: {new Date(r.scheduled_at).toLocaleString()}
                </p>
              )}
              {r.completed_at && (
                <p className="text-[10px] text-emerald-700">
                  Completed: {new Date(r.completed_at).toLocaleString()}
                </p>
              )}
              {r.cost !== null && r.cost !== undefined && (
                <p className="text-[10px] text-muted-foreground">Cost: ${Number(r.cost).toFixed(2)}</p>
              )}
              {r.technician_notes && <p className="mt-1 text-[10px] text-foreground">{r.technician_notes}</p>}
            </div>
          )
        })}
        {records.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-6">No maintenance records</p>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Lifecycle Tab
// ============================================================
type EventWithUser = AssetLifecycleEvent & {
  user?: { id: string; first_name: string | null; last_name: string | null; email: string } | null
}

const EVENT_COLORS: Record<string, string> = {
  installed: 'bg-emerald-100 text-emerald-700',
  serviced: 'bg-blue-100 text-blue-700',
  firmware_updated: 'bg-purple-100 text-purple-700',
  relocated: 'bg-amber-100 text-amber-700',
  retired: 'bg-neutral-100 text-neutral-600',
  rma_initiated: 'bg-red-100 text-red-700',
  replaced: 'bg-purple-100 text-purple-700',
  reactivated: 'bg-emerald-100 text-emerald-700',
  inspection_passed: 'bg-emerald-100 text-emerald-700',
  inspection_failed: 'bg-red-100 text-red-700',
}

function LifecycleTab({ assetId }: { assetId: string }) {
  const [events, setEvents] = useState<EventWithUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/org/assets/${assetId}/events`)
      if (res.ok) setEvents(await res.json())
      setLoading(false)
    })()
  }, [assetId])

  if (loading) return <div className="flex h-32 items-center justify-center"><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>

  return (
    <div>
      <div className="mb-3 flex items-center gap-1.5">
        <History className="h-3.5 w-3.5" />
        <h3 className="text-sm font-bold">Lifecycle Events</h3>
      </div>

      <div className="space-y-2">
        {events.map(e => {
          const color = EVENT_COLORS[e.event_type] ?? 'bg-neutral-100 text-neutral-600'
          const userName = e.user ? `${e.user.first_name ?? ''} ${e.user.last_name ?? ''}`.trim() || e.user.email : null
          return (
            <div key={e.id} className="flex items-start gap-2.5 rounded-md border border-border p-2.5">
              <Shield className="h-3.5 w-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${color}`}>
                    {e.event_type.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{new Date(e.event_at).toLocaleString()}</span>
                  {userName && <span className="text-[10px] text-muted-foreground">· {userName}</span>}
                </div>
                {e.details && Object.keys(e.details).length > 0 && (
                  <pre className="mt-1 text-[10px] font-mono text-muted-foreground whitespace-pre-wrap">
                    {JSON.stringify(e.details, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )
        })}
        {events.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-6">No lifecycle events</p>
        )}
      </div>
    </div>
  )
}
