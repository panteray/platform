'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Package, CheckCircle2, AlertTriangle, Clock, Wrench, Shield, ArrowLeft, Activity,
} from 'lucide-react'
import { DashboardWidget } from '@/components/shared/DashboardWidget'

type DashboardData = {
  totals: {
    total: number
    by_status: Record<string, number>
    warranty_expired: number
    warranty_expiring_90d: number
    upcoming_maintenance_30d: number
    overdue_maintenance: number
  }
  warranty_expiring: Array<{
    id: string
    label: string
    vendor: string | null
    model: string | null
    warranty_expires_at: string | null
    customer: { id: string; name: string } | null
  }>
  upcoming_maintenance?: Array<{
    id: string
    label: string
    maintenance_type: string | null
    scheduled_date: string | null
  }>
  recent_events?: Array<{
    id: string
    asset_id: string
    asset_label: string
    event_type: string
    description: string | null
    created_at: string
  }>
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.floor((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function DaysBadge({ days }: { days: number | null }) {
  if (days === null) return <span className="text-xs text-slate-400">—</span>
  if (days < 0) {
    return (
      <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800">
        Expired {Math.abs(days)}d ago
      </span>
    )
  }
  if (days <= 30) {
    return (
      <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800">
        {days}d remaining
      </span>
    )
  }
  if (days <= 60) {
    return (
      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
        {days}d remaining
      </span>
    )
  }
  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
      {days}d remaining
    </span>
  )
}

function EventTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    created: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    maintenance: 'border-blue-200 bg-blue-50 text-blue-800',
    warranty: 'border-amber-200 bg-amber-50 text-amber-800',
    rma: 'border-red-200 bg-red-50 text-red-800',
    status_change: 'border-purple-200 bg-purple-50 text-purple-800',
    firmware_update: 'border-cyan-200 bg-cyan-50 text-cyan-800',
  }
  const cls = colors[type] ?? 'border-slate-200 bg-slate-50 text-slate-700'
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {type.replace(/_/g, ' ')}
    </span>
  )
}

export default function AssetDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/org/assets/dashboard')
      if (res.ok) setData(await res.json())
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
      </div>
    )
  }

  const totals = data?.totals

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/org/assets"
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Asset Intelligence Dashboard</h1>
            <p className="text-sm text-slate-600">Overview of asset health, warranties, and maintenance schedules.</p>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <DashboardWidget
          label="Total Assets"
          icon={Package}
          value={totals?.total ?? 0}
          accentIndex={0}
        />
        <DashboardWidget
          label="Active"
          icon={CheckCircle2}
          value={totals?.by_status?.active ?? 0}
          accentIndex={2}
        />
        <DashboardWidget
          label="Warranty Expiring 30d"
          icon={AlertTriangle}
          value={totals?.warranty_expiring_90d ?? 0}
          description={totals?.warranty_expired ? `${totals.warranty_expired} already expired` : undefined}
          accentIndex={5}
        />
        <DashboardWidget
          label="Overdue Maintenance"
          icon={Clock}
          value={totals?.overdue_maintenance ?? 0}
          description={totals?.upcoming_maintenance_30d ? `${totals.upcoming_maintenance_30d} upcoming in 30d` : undefined}
          accentIndex={6}
        />
      </div>

      {/* Warranty Expiring (90 days) */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <Shield className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-slate-900">Warranty Expiring (next 90 days)</h2>
        </div>
        {(data?.warranty_expiring ?? []).length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">No warranties expiring in the next 90 days.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Asset</th>
                <th className="px-4 py-2 text-left font-medium">Vendor</th>
                <th className="px-4 py-2 text-left font-medium">Model</th>
                <th className="px-4 py-2 text-left font-medium">Expires</th>
                <th className="px-4 py-2 text-left font-medium">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {(data?.warranty_expiring ?? []).map(a => {
                const days = daysUntil(a.warranty_expires_at)
                return (
                  <tr key={a.id} className="border-t border-slate-100">
                    <td className="px-4 py-2">
                      <Link href={`/org/assets/${a.id}`} className="font-medium text-slate-900 hover:underline">
                        {a.label}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-slate-600">{a.vendor ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-600">{a.model ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-600">
                      {a.warranty_expires_at ? new Date(a.warranty_expires_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-2"><DaysBadge days={days} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Upcoming Maintenance */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <Wrench className="h-4 w-4 text-blue-500" />
          <h2 className="text-sm font-semibold text-slate-900">Upcoming Maintenance</h2>
        </div>
        {(data?.upcoming_maintenance ?? []).length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">No upcoming maintenance scheduled.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Asset</th>
                <th className="px-4 py-2 text-left font-medium">Type</th>
                <th className="px-4 py-2 text-left font-medium">Scheduled</th>
              </tr>
            </thead>
            <tbody>
              {(data?.upcoming_maintenance ?? []).map(m => (
                <tr key={m.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium text-slate-900">{m.label}</td>
                  <td className="px-4 py-2 text-slate-600">{m.maintenance_type ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {m.scheduled_date ? new Date(m.scheduled_date).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent Lifecycle Events */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <Activity className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-900">Recent Lifecycle Events</h2>
        </div>
        {(data?.recent_events ?? []).length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">No recent lifecycle events.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {(data?.recent_events ?? []).map(evt => (
              <div key={evt.id} className="flex items-center gap-3 px-4 py-3">
                <EventTypeBadge type={evt.event_type} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-slate-900">{evt.asset_label}</span>
                  {evt.description && (
                    <span className="ml-2 text-sm text-slate-500">{evt.description}</span>
                  )}
                </div>
                <span className="shrink-0 text-xs text-slate-400">
                  {new Date(evt.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
