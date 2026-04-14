'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  FolderKanban, Plus, Search, LayoutGrid, List,
  Calendar, MapPin, AlertTriangle, CheckCircle2, Clock,
  Pause, XCircle,
} from 'lucide-react'
import type { Project } from '@/types/database'

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  planning:    { label: 'Planning',   color: 'bg-blue-100 text-blue-700',    icon: Calendar },
  active:      { label: 'Active',     color: 'bg-emerald-100 text-emerald-700', icon: Clock },
  on_hold:     { label: 'On Hold',    color: 'bg-amber-100 text-amber-700',  icon: Pause },
  punch_list:  { label: 'Punch List', color: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
  closeout:    { label: 'Closeout',   color: 'bg-purple-100 text-purple-700', icon: CheckCircle2 },
  completed:   { label: 'Completed',  color: 'bg-neutral-100 text-neutral-600', icon: CheckCircle2 },
  cancelled:   { label: 'Cancelled',  color: 'bg-red-100 text-red-700',      icon: XCircle },
}

const KANBAN_STATUSES = ['planning', 'active', 'on_hold', 'punch_list', 'closeout', 'completed'] as const

export default function ProjectsPage() {
  const [projects, setProjects] = useState<(Project & { pm?: { first_name: string; last_name: string } | null; customer?: { name: string } | null })[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'kanban' | 'table'>('kanban')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/org/projects')
    if (res.ok) setProjects(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = projects.filter(p => {
    const q = search.toLowerCase()
    if (!q) return true
    return (
      p.name.toLowerCase().includes(q) ||
      (p.pn ?? '').toLowerCase().includes(q) ||
      (p.site_city ?? '').toLowerCase().includes(q) ||
      (p.customer?.name ?? '').toLowerCase().includes(q)
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
          <FolderKanban className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">Projects</h1>
          <span className="text-xs text-muted-foreground">({projects.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="rounded-md border border-border bg-background pl-7 pr-3 py-1.5 text-xs outline-none focus:border-primary w-56"
            />
          </div>
          <div className="flex rounded-md border border-border">
            <button
              onClick={() => setView('kanban')}
              className={`px-2 py-1.5 ${view === 'kanban' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setView('table')}
              className={`px-2 py-1.5 ${view === 'table' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
          <Link
            href="/org/projects/new"
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" /> New Project
          </Link>
        </div>
      </div>

      {/* Kanban View */}
      {view === 'kanban' && (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {KANBAN_STATUSES.map(status => {
            const cfg = STATUS_CONFIG[status]
            const items = filtered.filter(p => p.status === status)
            return (
              <div key={status} className="min-w-[260px] flex-shrink-0">
                <div className="mb-2 flex items-center gap-1.5">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.color}`}>
                    {cfg.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map(p => (
                    <ProjectCard key={p.id} project={p} />
                  ))}
                  {items.length === 0 && (
                    <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-[11px] text-muted-foreground">
                      No projects
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Table View */}
      {view === 'table' && (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2 text-left font-semibold">PN</th>
                <th className="px-3 py-2 text-left font-semibold">Name</th>
                <th className="px-3 py-2 text-left font-semibold">Customer</th>
                <th className="px-3 py-2 text-left font-semibold">PM</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2 text-left font-semibold">Location</th>
                <th className="px-3 py-2 text-left font-semibold">Target End</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.planning
                return (
                  <tr key={p.id} className="border-b border-border hover:bg-accent/30 transition-colors">
                    <td className="px-3 py-2">
                      <Link href={`/org/projects/${p.id}`} className="font-medium text-primary hover:underline">
                        {p.pn ?? '—'}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-foreground">{p.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.customer?.name ?? '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {p.pm ? `${p.pm.first_name} ${p.pm.last_name}` : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-bold ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {p.site_city && p.site_state ? `${p.site_city}, ${p.site_state}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {p.target_end_date ? new Date(p.target_end_date).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    No projects found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ProjectCard({ project: p }: { project: Project & { pm?: { first_name: string; last_name: string } | null; customer?: { name: string } | null } }) {
  return (
    <Link
      href={`/org/projects/${p.id}`}
      className="block rounded-lg border border-border bg-card p-3 hover:border-primary/30 transition-colors"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-bold text-primary">{p.pn}</span>
        {p.risk_level && p.risk_level !== 'LOW' && (
          <span className="flex items-center gap-0.5 text-[9px] font-bold text-amber-600">
            <AlertTriangle className="h-2.5 w-2.5" />
            {p.risk_level}
          </span>
        )}
      </div>
      <p className="text-xs font-medium text-foreground truncate">{p.name}</p>
      {p.customer?.name && (
        <p className="text-[10px] text-muted-foreground mt-0.5">{p.customer.name}</p>
      )}
      <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
        {p.pm && (
          <span>{p.pm.first_name} {p.pm.last_name}</span>
        )}
        {p.site_city && (
          <span className="flex items-center gap-0.5">
            <MapPin className="h-2.5 w-2.5" />
            {p.site_city}
          </span>
        )}
      </div>
      {p.target_end_date && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          Target: {new Date(p.target_end_date).toLocaleDateString()}
        </p>
      )}
    </Link>
  )
}
