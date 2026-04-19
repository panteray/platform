'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { HardHat, MapPin, Clock, AlertTriangle, ArrowRight } from 'lucide-react'
import type { Project } from '@/types/database'
import { InstallAppButton } from '@/components/layout/InstallAppButton'

type FieldProject = Project & {
  pm?: { first_name: string | null; last_name: string | null } | null
  customer?: { name: string } | null
}

const FIELD_STATUSES = ['active', 'punch_list', 'closeout'] as const

const STATUS_COLOR: Record<string, string> = {
  active:     'bg-emerald-100 text-emerald-700',
  punch_list: 'bg-orange-100 text-orange-700',
  closeout:   'bg-purple-100 text-purple-700',
}

export default function FieldOpsPage() {
  const [projects, setProjects] = useState<FieldProject[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/org/projects')
    if (res.ok) {
      const data: FieldProject[] = await res.json()
      setProjects(data.filter((p) => (FIELD_STATUSES as readonly string[]).includes(p.status)))
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = projects.filter((p) => {
    const q = search.toLowerCase()
    if (!q) return true
    return (
      p.name.toLowerCase().includes(q) ||
      (p.pn ?? '').toLowerCase().includes(q) ||
      (p.site_city ?? '').toLowerCase().includes(q) ||
      (p.customer?.name ?? '').toLowerCase().includes(q)
    )
  })

  const byStatus = {
    active:     filtered.filter((p) => p.status === 'active'),
    punch_list: filtered.filter((p) => p.status === 'punch_list'),
    closeout:   filtered.filter((p) => p.status === 'closeout'),
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <HardHat className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">Field Ops</h1>
          <span className="text-xs text-muted-foreground">({filtered.length} projects in field)</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects, PN, site, customer…"
            className="w-64 rounded-md border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-primary"
          />
          <InstallAppButton label="Install for Field Use" />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <StatCard label="Active" count={byStatus.active.length} color="text-emerald-700" />
        <StatCard label="Punch List" count={byStatus.punch_list.length} color="text-orange-700" />
        <StatCard label="Closeout" count={byStatus.closeout.length} color="text-purple-700" />
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <HardHat className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">No projects currently in field phase</p>
          <p className="mt-1 text-xs text-muted-foreground">Projects in <strong>active</strong>, <strong>punch list</strong>, or <strong>closeout</strong> status appear here</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2 text-left font-semibold">PN</th>
                <th className="px-3 py-2 text-left font-semibold">Project</th>
                <th className="px-3 py-2 text-left font-semibold">Customer</th>
                <th className="px-3 py-2 text-left font-semibold">Site</th>
                <th className="px-3 py-2 text-left font-semibold">PM</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2 text-left font-semibold">Risk</th>
                <th className="px-3 py-2 text-right font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const pmName = p.pm ? `${p.pm.first_name ?? ''} ${p.pm.last_name ?? ''}`.trim() : '—'
                return (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                    <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{p.pn ?? '—'}</td>
                    <td className="px-3 py-2">
                      <Link href={`/org/projects/${p.id}/field`} className="font-medium text-primary hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{p.customer?.name ?? '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {p.site_city ?? '—'}{p.site_state ? `, ${p.site_state}` : ''}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{pmName}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_COLOR[p.status] ?? 'bg-neutral-100 text-neutral-600'}`}>
                        {p.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {p.risk_score != null ? (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${p.risk_score >= 3 ? 'text-red-600' : p.risk_score >= 2 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {p.risk_score >= 3 && <AlertTriangle className="h-3 w-3" />}
                          {p.risk_score}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/org/projects/${p.id}/field`}
                        className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] font-semibold text-primary hover:bg-accent"
                      >
                        Enter field view <ArrowRight className="h-3 w-3" />
                      </Link>
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

function StatCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        <Clock className="h-3 w-3" />
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold ${color}`}>{count}</div>
    </div>
  )
}
