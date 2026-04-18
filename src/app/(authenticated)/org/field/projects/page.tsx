'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { MapPin, HardHat, Search, ChevronRight } from 'lucide-react'
import type { Project } from '@/types/database'
import { useUser } from '@/hooks/useUser'

type FieldProject = Project & {
  pm?: { id: string; first_name: string | null; last_name: string | null } | null
  customer?: { name: string } | null
}

type Filter = 'mine' | 'all' | 'active' | 'punch_list' | 'closeout'

const STATUS_COLOR: Record<string, string> = {
  planning:    'bg-blue-100 text-blue-700',
  active:      'bg-emerald-100 text-emerald-700',
  on_hold:     'bg-amber-100 text-amber-700',
  punch_list:  'bg-orange-100 text-orange-700',
  closeout:    'bg-purple-100 text-purple-700',
  completed:   'bg-neutral-100 text-neutral-600',
  cancelled:   'bg-red-100 text-red-700',
}

export default function FieldProjectsPage() {
  const { user } = useUser()
  const [projects, setProjects] = useState<FieldProject[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('mine')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/org/projects')
    if (res.ok) setProjects(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const counts = useMemo(() => {
    const mine = user ? projects.filter((p) => p.pm_id === user.id) : []
    return {
      mine: mine.length,
      all: projects.length,
      active: projects.filter((p) => p.status === 'active').length,
      punch_list: projects.filter((p) => p.status === 'punch_list').length,
      closeout: projects.filter((p) => p.status === 'closeout').length,
    }
  }, [projects, user])

  const filtered = useMemo(() => {
    let list = projects
    if (filter === 'mine' && user) list = list.filter((p) => p.pm_id === user.id)
    else if (filter !== 'all' && filter !== 'mine') list = list.filter((p) => p.status === filter)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        (p.pn ?? '').toLowerCase().includes(q) ||
        (p.customer?.name ?? '').toLowerCase().includes(q) ||
        (p.site_city ?? '').toLowerCase().includes(q),
      )
    }
    return list
  }, [projects, filter, search, user])

  const chips: Array<{ key: Filter; label: string; count: number }> = [
    { key: 'mine',       label: 'Mine',       count: counts.mine },
    { key: 'active',     label: 'Active',     count: counts.active },
    { key: 'punch_list', label: 'Punch',      count: counts.punch_list },
    { key: 'closeout',   label: 'Closeout',   count: counts.closeout },
    { key: 'all',        label: 'All',        count: counts.all },
  ]

  return (
    <div className="-m-6 min-h-[calc(100dvh-56px)] bg-neutral-50">
      <div className="border-b border-neutral-200 bg-white px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <HardHat className="h-5 w-5 text-blue-600" />
          <h1 className="text-[22px] font-bold tracking-tight text-neutral-900">Field Projects</h1>
        </div>
        <p className="mt-0.5 text-xs text-neutral-500">Your assigned jobs by PN</p>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PN, project, customer…"
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:bg-white"
          />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-neutral-200 bg-white px-5 py-3">
        {chips.map((c) => {
          const isActive = filter === c.key
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setFilter(c.key)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                isActive
                  ? 'border-neutral-900 bg-neutral-900 text-white'
                  : 'border-neutral-200 bg-white text-neutral-600'
              }`}
            >
              {c.label} ({c.count})
            </button>
          )
        })}
      </div>

      <div className="p-4 pb-28">
        {loading ? (
          <div className="flex h-48 items-center justify-center text-sm text-neutral-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-200 bg-white py-14 text-center">
            <HardHat className="mx-auto h-10 w-10 text-neutral-300" />
            <p className="mt-3 text-sm font-medium text-neutral-500">
              {filter === 'mine' ? 'No projects assigned to you' : 'No projects'}
            </p>
            <p className="mt-1 px-8 text-xs text-neutral-400">
              {filter === 'mine'
                ? 'Projects where you are the PM will appear here'
                : 'Try a different filter'}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((p) => (
              <Link
                key={p.id}
                href={`/org/field/projects/${p.id}`}
                className="block rounded-2xl border border-neutral-200 bg-white p-4 transition active:scale-[.99] active:bg-neutral-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[11px] font-semibold text-blue-600">
                      PN {p.pn ?? '—'}
                    </div>
                    <div className="mt-0.5 truncate text-[15px] font-semibold text-neutral-900">
                      {p.name}
                    </div>
                    {p.customer?.name && (
                      <div className="mt-0.5 truncate text-[12px] text-neutral-500">{p.customer.name}</div>
                    )}
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-neutral-300" />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  {(p.site_city || p.site_state) && (
                    <div className="flex items-center gap-1 text-[11px] text-neutral-500">
                      <MapPin className="h-3 w-3" />
                      {[p.site_city, p.site_state].filter(Boolean).join(', ')}
                    </div>
                  )}
                  <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_COLOR[p.status] ?? 'bg-neutral-100 text-neutral-600'}`}>
                    {p.status.replace('_', ' ')}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
