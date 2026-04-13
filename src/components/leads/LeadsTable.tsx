'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowUpDown, Plus, Search, MoreHorizontal, Trash2, ExternalLink } from 'lucide-react'
import { LeadStatusBadge } from './LeadStatusBadge'
import { LeadPriorityBadge } from './LeadPriorityBadge'
import type { Lead } from '@/types/database'

interface LeadsTableProps {
  leads: Lead[]
  loading: boolean
  onDelete: (id: string) => void
  onCreateClick: () => void
}

type SortKey = 'lead_number' | 'contact_last_name' | 'company_name' | 'status' | 'priority' | 'source' | 'estimated_value' | 'created_at'

export function LeadsTable({ leads, loading, onDelete, onCreateClick }: LeadsTableProps) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortAsc, setSortAsc] = useState(false)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL')

  const filtered = leads.filter((l) => {
    const q = search.toLowerCase()
    const matchesSearch =
      (l.contact_first_name ?? '').toLowerCase().includes(q) ||
      (l.contact_last_name ?? '').toLowerCase().includes(q) ||
      (l.company_name ?? '').toLowerCase().includes(q) ||
      (l.lead_number ?? '').toLowerCase().includes(q) ||
      (l.contact_email ?? '').toLowerCase().includes(q)
    const matchesStatus = statusFilter === 'ALL' || l.status === statusFilter
    const matchesPriority = priorityFilter === 'ALL' || l.priority === priorityFilter
    return matchesSearch && matchesStatus && matchesPriority
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === 'estimated_value') {
      const av = a.estimated_value ?? -1
      const bv = b.estimated_value ?? -1
      return sortAsc ? av - bv : bv - av
    }
    const av = String((a as unknown as Record<string, unknown>)[sortKey] ?? '')
    const bv = String((b as unknown as Record<string, unknown>)[sortKey] ?? '')
    const cmp = av.localeCompare(bv)
    return sortAsc ? cmp : -cmp
  })

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(true) }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading leads...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="ALL">All Status</option>
          <option value="NEW">New</option>
          <option value="CONTACTED">Contacted</option>
          <option value="QUALIFYING">Qualifying</option>
          <option value="QUALIFIED">Qualified</option>
          <option value="CONVERTED">Converted</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="ALL">All Priority</option>
          <option value="HOT">Hot</option>
          <option value="WARM">Warm</option>
          <option value="COLD">Cold</option>
        </select>
        <button
          onClick={onCreateClick}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Lead
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {search || statusFilter !== 'ALL' || priorityFilter !== 'ALL'
              ? 'No leads match your filters.'
              : 'No leads yet. Create your first lead above.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                {[
                  { key: 'lead_number' as SortKey, label: '#' },
                  { key: 'contact_last_name' as SortKey, label: 'Contact' },
                  { key: 'company_name' as SortKey, label: 'Company' },
                  { key: 'status' as SortKey, label: 'Status' },
                  { key: 'priority' as SortKey, label: 'Priority' },
                  { key: 'source' as SortKey, label: 'Source' },
                  { key: 'estimated_value' as SortKey, label: 'Est. Value' },
                ].map((col) => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className="cursor-pointer px-3 py-2.5 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      <ArrowUpDown className="h-3 w-3" />
                    </span>
                  </th>
                ))}
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">State</th>
                <th className="w-10 px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{l.lead_number}</td>
                  <td className="px-3 py-2">
                    <Link href={`/org/leads/${l.id}`} className="font-medium text-foreground hover:underline">
                      {l.contact_first_name} {l.contact_last_name}
                    </Link>
                    {l.contact_email && (
                      <div className="text-xs text-muted-foreground">{l.contact_email}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{l.company_name ?? '—'}</td>
                  <td className="px-3 py-2"><LeadStatusBadge status={l.status} /></td>
                  <td className="px-3 py-2"><LeadPriorityBadge priority={l.priority} /></td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{l.source?.replace(/_/g, ' ') ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {l.estimated_value != null ? `$${l.estimated_value.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{l.state ?? '—'}</td>
                  <td className="px-2 py-2">
                    <div className="relative">
                      <button
                        onClick={() => setMenuOpen(menuOpen === l.id ? null : l.id)}
                        className="rounded p-1 hover:bg-muted"
                      >
                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                      </button>
                      {menuOpen === l.id && (
                        <div className="absolute right-0 z-10 mt-1 w-36 rounded-md border border-border bg-card py-1 shadow-md">
                          <Link
                            href={`/org/leads/${l.id}`}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted"
                            onClick={() => setMenuOpen(null)}
                          >
                            <ExternalLink className="h-3 w-3" /> View Detail
                          </Link>
                          <button
                            onClick={() => { onDelete(l.id); setMenuOpen(null) }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-muted"
                          >
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
