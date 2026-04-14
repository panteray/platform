'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, Circle, AlertTriangle, Wrench, Search } from 'lucide-react'
import type { InstallItem } from '@/types/database'

interface Props { projectId: string }

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  planned:                  { label: 'Planned',    color: 'text-muted-foreground', bg: 'bg-muted' },
  installation_requested:   { label: 'Requested',  color: 'text-blue-600',        bg: 'bg-blue-100' },
  installed:                { label: 'Installed',   color: 'text-emerald-600',     bg: 'bg-emerald-100' },
  deviation:                { label: 'Deviation',   color: 'text-red-600',         bg: 'bg-red-100' },
}

export function ProjectInstallTab({ projectId }: Props) {
  const [items, setItems] = useState<(InstallItem & { installer?: { first_name: string; last_name: string } | null })[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  const load = useCallback(async () => {
    let url = `/api/org/projects/${projectId}/install`
    if (statusFilter) url += `?status=${statusFilter}`
    const res = await fetch(url)
    if (res.ok) setItems(await res.json())
    setLoading(false)
  }, [projectId, statusFilter])

  useEffect(() => { load() }, [load])

  const updateItemStatus = async (itemId: string, status: string) => {
    await fetch(`/api/org/projects/${projectId}/install/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    await load()
  }

  const filtered = items.filter(item => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      item.label.toLowerCase().includes(q) ||
      (item.vendor ?? '').toLowerCase().includes(q) ||
      (item.model ?? '').toLowerCase().includes(q) ||
      (item.serial_number ?? '').toLowerCase().includes(q)
    )
  })

  const totalCount = items.length
  const installedCount = items.filter(i => i.status === 'installed').length
  const deviationCount = items.filter(i => i.status === 'deviation').length
  const progressPct = totalCount > 0 ? Math.round((installedCount / totalCount) * 100) : 0

  if (loading) return <div className="flex h-32 items-center justify-center"><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Install Verification</h3>
          <p className="text-[10px] text-muted-foreground">
            {installedCount}/{totalCount} installed ({progressPct}%)
            {deviationCount > 0 && <span className="text-red-500 ml-1">· {deviationCount} deviations</span>}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search items..."
            className="w-full rounded border border-border bg-background pl-7 pr-2.5 py-1.5 text-xs outline-none focus:border-primary"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
        >
          <option value="">All Statuses</option>
          <option value="planned">Planned</option>
          <option value="installation_requested">Requested</option>
          <option value="installed">Installed</option>
          <option value="deviation">Deviation</option>
        </select>
      </div>

      {/* Item List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-muted-foreground">
          <Wrench className="mb-2 h-6 w-6 text-muted-foreground/40" />
          <p className="text-xs">No install items</p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
            Items are created when a project is created from an opportunity
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-2.5 py-2 text-left font-semibold w-8">#</th>
                <th className="px-2.5 py-2 text-left font-semibold">Label</th>
                <th className="px-2.5 py-2 text-left font-semibold">Category</th>
                <th className="px-2.5 py-2 text-left font-semibold">Vendor / Model</th>
                <th className="px-2.5 py-2 text-left font-semibold">Serial</th>
                <th className="px-2.5 py-2 text-left font-semibold">Status</th>
                <th className="px-2.5 py-2 text-left font-semibold">Installed By</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => {
                const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.planned
                const StatusIcon = item.status === 'installed' ? CheckCircle2
                  : item.status === 'deviation' ? AlertTriangle
                  : Circle

                return (
                  <tr key={item.id} className="border-b border-border hover:bg-accent/30">
                    <td className="px-2.5 py-2 text-muted-foreground">{item.hw_schedule_line ?? i + 1}</td>
                    <td className="px-2.5 py-2 font-medium text-foreground">{item.label}</td>
                    <td className="px-2.5 py-2 text-muted-foreground">{item.category ?? '—'}</td>
                    <td className="px-2.5 py-2 text-muted-foreground">
                      {[item.vendor, item.model].filter(Boolean).join(' / ') || '—'}
                    </td>
                    <td className="px-2.5 py-2 text-muted-foreground font-mono text-[10px]">
                      {item.serial_number ?? '—'}
                    </td>
                    <td className="px-2.5 py-2">
                      <select
                        value={item.status}
                        onChange={e => updateItemStatus(item.id, e.target.value)}
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold border-0 outline-none ${cfg.bg} ${cfg.color}`}
                      >
                        <option value="planned">Planned</option>
                        <option value="installation_requested">Requested</option>
                        <option value="installed">Installed</option>
                        <option value="deviation">Deviation</option>
                      </select>
                    </td>
                    <td className="px-2.5 py-2 text-muted-foreground">
                      {item.installer ? `${item.installer.first_name} ${item.installer.last_name}` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
