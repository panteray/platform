'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Package, Search, AlertTriangle, CheckCircle2, Wrench,
  Shield, Clock, Filter,
} from 'lucide-react'
import type { Asset, AssetStatus } from '@/types/database'

type AssetWithRefs = Asset & {
  customer?: { id: string; name: string } | null
  project?: { id: string; pn: string | null; name: string } | null
}

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
}

const STATUS_CONFIG: Record<AssetStatus, { label: string; color: string }> = {
  active:      { label: 'Active',      color: 'bg-emerald-100 text-emerald-700' },
  maintenance: { label: 'Maintenance', color: 'bg-amber-100 text-amber-700' },
  retired:     { label: 'Retired',     color: 'bg-neutral-100 text-neutral-600' },
  rma:         { label: 'RMA',         color: 'bg-red-100 text-red-700' },
  lost:        { label: 'Lost',        color: 'bg-red-100 text-red-700' },
  replaced:    { label: 'Replaced',    color: 'bg-purple-100 text-purple-700' },
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<AssetWithRefs[]>([])
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<AssetStatus | 'all'>('all')
  const [warrantyFilter, setWarrantyFilter] = useState(false)

  const load = useCallback(async () => {
    const params = new URLSearchParams()
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (warrantyFilter) params.set('warranty_expiring', '90')
    const [assetsRes, dashRes] = await Promise.all([
      fetch(`/api/org/assets?${params.toString()}`),
      fetch('/api/org/assets/dashboard'),
    ])
    if (assetsRes.ok) setAssets(await assetsRes.json())
    if (dashRes.ok) setDashboard(await dashRes.json())
    setLoading(false)
  }, [statusFilter, warrantyFilter])

  useEffect(() => { load() }, [load])

  const filtered = assets.filter(a => {
    const q = search.toLowerCase()
    if (!q) return true
    return (
      a.label.toLowerCase().includes(q) ||
      (a.serial_number ?? '').toLowerCase().includes(q) ||
      (a.vendor ?? '').toLowerCase().includes(q) ||
      (a.model ?? '').toLowerCase().includes(q) ||
      (a.asset_tag ?? '').toLowerCase().includes(q) ||
      (a.customer?.name ?? '').toLowerCase().includes(q)
    )
  })

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">Asset Intelligence</h1>
          <span className="text-xs text-muted-foreground">({dashboard?.totals.total ?? 0})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search serial, vendor, model, customer..."
              className="rounded-md border border-border bg-background pl-7 pr-3 py-1.5 text-xs outline-none focus:border-primary w-64"
            />
          </div>
        </div>
      </div>

      {/* Dashboard Widgets */}
      {dashboard && (
        <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Active Assets
            </div>
            <p className="mt-1 text-2xl font-bold text-foreground">{dashboard.totals.by_status.active ?? 0}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-muted-foreground">
              <Shield className="h-3 w-3 text-amber-500" /> Warranty ≤90d
            </div>
            <p className="mt-1 text-2xl font-bold text-amber-600">{dashboard.totals.warranty_expiring_90d}</p>
            {dashboard.totals.warranty_expired > 0 && (
              <p className="text-[10px] text-red-600 mt-0.5">+{dashboard.totals.warranty_expired} expired</p>
            )}
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-muted-foreground">
              <Wrench className="h-3 w-3 text-blue-500" /> Upcoming PM ≤30d
            </div>
            <p className="mt-1 text-2xl font-bold text-foreground">{dashboard.totals.upcoming_maintenance_30d}</p>
            {dashboard.totals.overdue_maintenance > 0 && (
              <p className="text-[10px] text-red-600 mt-0.5">{dashboard.totals.overdue_maintenance} overdue</p>
            )}
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-muted-foreground">
              <AlertTriangle className="h-3 w-3 text-red-500" /> RMA / Issues
            </div>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {(dashboard.totals.by_status.rma ?? 0) + (dashboard.totals.by_status.maintenance ?? 0)}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-3 flex items-center gap-2 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <button
          onClick={() => setStatusFilter('all')}
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
        >
          All
        </button>
        {(Object.entries(STATUS_CONFIG) as [AssetStatus, typeof STATUS_CONFIG.active][]).map(([s, cfg]) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
          >
            {cfg.label}
          </button>
        ))}
        <button
          onClick={() => setWarrantyFilter(!warrantyFilter)}
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold inline-flex items-center gap-1 ${warrantyFilter ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
        >
          <Shield className="h-2.5 w-2.5" /> Warranty ≤90d
        </button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-2 text-left font-semibold">Label</th>
              <th className="px-3 py-2 text-left font-semibold">Serial</th>
              <th className="px-3 py-2 text-left font-semibold">Vendor / Model</th>
              <th className="px-3 py-2 text-left font-semibold">Customer</th>
              <th className="px-3 py-2 text-left font-semibold">Project</th>
              <th className="px-3 py-2 text-left font-semibold">Status</th>
              <th className="px-3 py-2 text-left font-semibold">Warranty</th>
              <th className="px-3 py-2 text-left font-semibold">Firmware</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(a => {
              const cfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.active
              const warrantyDate = a.warranty_expires_at ? new Date(a.warranty_expires_at) : null
              const daysLeft = warrantyDate ? Math.floor((warrantyDate.getTime() - Date.now()) / 86400000) : null
              const warrantyExpired = daysLeft !== null && daysLeft < 0
              const warrantyWarn = daysLeft !== null && daysLeft >= 0 && daysLeft < 90
              return (
                <tr key={a.id} className="border-b border-border hover:bg-accent/30 transition-colors">
                  <td className="px-3 py-2">
                    <Link href={`/org/assets/${a.id}`} className="font-medium text-primary hover:underline">
                      {a.label}
                    </Link>
                    {a.asset_tag && <div className="text-[10px] text-muted-foreground font-mono">{a.asset_tag}</div>}
                  </td>
                  <td className="px-3 py-2 text-foreground font-mono">{a.serial_number ?? '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {a.vendor ?? ''} {a.model ?? ''}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{a.customer?.name ?? '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {a.project ? (
                      <Link href={`/org/projects/${a.project.id}`} className="hover:underline">
                        {a.project.pn ?? a.project.name}
                      </Link>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-bold ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {warrantyDate ? (
                      <span className={`text-[10px] ${warrantyExpired ? 'text-red-600 font-bold' : warrantyWarn ? 'text-amber-600 font-bold' : 'text-muted-foreground'}`}>
                        {warrantyDate.toLocaleDateString()}
                        {warrantyExpired && ' (expired)'}
                        {warrantyWarn && ` (${daysLeft}d)`}
                      </span>
                    ) : <span className="text-[10px] text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 text-[10px] text-muted-foreground font-mono">{a.firmware_version ?? '—'}</td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  <Clock className="mx-auto mb-2 h-6 w-6 opacity-40" />
                  <p className="text-xs">No assets found</p>
                  <p className="text-[10px] mt-0.5">Assets auto-generate when install items transition to &quot;installed&quot; status</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
