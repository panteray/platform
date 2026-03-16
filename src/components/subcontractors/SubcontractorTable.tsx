'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowUpDown, Plus, Search, MoreHorizontal, Trash2, ExternalLink } from 'lucide-react'
import { StatusBadge, TierBadge, ScoreBadge } from '@/components/shared/EntityHelpers'
import type { Subcontractor } from '@/types/database'

interface SubcontractorTableProps {
  subcontractors: Subcontractor[]
  loading: boolean
  onDelete: (id: string) => void
  onCreateClick: () => void
}

type SortKey = 'name' | 'sub_number' | 'status' | 'region_state' | 'overall_score' | 'created_at'

export function SubcontractorTable({ subcontractors, loading, onDelete, onCreateClick }: SubcontractorTableProps) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortAsc, setSortAsc] = useState(false)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const filtered = subcontractors.filter((s) => {
    const q = search.toLowerCase()
    return (
      s.name.toLowerCase().includes(q) ||
      (s.sub_number ?? '').toLowerCase().includes(q) ||
      (s.contact_name ?? '').toLowerCase().includes(q) ||
      (s.contact_email ?? '').toLowerCase().includes(q)
    )
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === 'overall_score') {
      const av = a.overall_score ?? -1
      const bv = b.overall_score ?? -1
      return sortAsc ? av - bv : bv - av
    }
    const av = (a[sortKey] ?? '') as string
    const bv = (b[sortKey] ?? '') as string
    const cmp = String(av).localeCompare(String(bv))
    return sortAsc ? cmp : -cmp
  })

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(true) }
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><p className="text-sm text-muted-foreground">Loading subcontractors...</p></div>
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Search subcontractors..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <button onClick={onCreateClick} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> New Subcontractor
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">{search ? 'No subcontractors match your search.' : 'No subcontractors yet.'}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                {([
                  ['sub_number', '#'], ['name', 'Name'], ['status', 'Status'],
                ] as [SortKey, string][]).map(([key, label]) => (
                  <th key={key} onClick={() => toggleSort(key)} className="cursor-pointer px-3 py-2.5 text-left text-xs font-medium text-muted-foreground hover:text-foreground">
                    <span className="inline-flex items-center gap-1">{label}<ArrowUpDown className="h-3 w-3" /></span>
                  </th>
                ))}
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Type</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Preferred</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">State</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Contact</th>
                <th onClick={() => toggleSort('overall_score')} className="cursor-pointer px-3 py-2.5 text-left text-xs font-medium text-muted-foreground hover:text-foreground">
                  <span className="inline-flex items-center gap-1">Score<ArrowUpDown className="h-3 w-3" /></span>
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Last Audit</th>
                <th className="w-10 px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{s.sub_number}</td>
                  <td className="px-3 py-2">
                    <Link href={`/org/subcontractors/${s.id}`} className="font-medium text-foreground hover:underline">{s.name}</Link>
                  </td>
                  <td className="px-3 py-2"><StatusBadge status={s.status} /></td>
                  <td className="px-3 py-2 text-muted-foreground">{s.type ?? '—'}</td>
                  <td className="px-3 py-2">{s.is_preferred ? <TierBadge tier="Preferred" /> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.region_state ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{s.contact_email ?? '—'}</td>
                  <td className="px-3 py-2"><ScoreBadge score={s.overall_score} /></td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{s.last_audit_date ? new Date(s.last_audit_date).toLocaleDateString() : '—'}</td>
                  <td className="px-2 py-2">
                    <div className="relative">
                      <button onClick={() => setMenuOpen(menuOpen === s.id ? null : s.id)} className="rounded p-1 hover:bg-muted">
                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                      </button>
                      {menuOpen === s.id && (
                        <div className="absolute right-0 z-10 mt-1 w-36 rounded-md border border-border bg-card py-1 shadow-md">
                          <Link href={`/org/subcontractors/${s.id}`} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted" onClick={() => setMenuOpen(null)}>
                            <ExternalLink className="h-3 w-3" /> View Detail
                          </Link>
                          <button onClick={() => { onDelete(s.id); setMenuOpen(null) }} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-muted">
                            <Trash2 className="h-3 w-3" /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
