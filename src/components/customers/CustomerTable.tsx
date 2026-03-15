'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowUpDown, Plus, Search, MoreHorizontal, Trash2, ExternalLink } from 'lucide-react'
import type { Customer } from '@/types/database'

interface CustomerTableProps {
  customers: Customer[]
  loading: boolean
  onDelete: (id: string) => void
  onCreateClick: () => void
}

type SortKey = 'name' | 'customer_number' | 'customer_type' | 'tier' | 'status' | 'created_at'

export function CustomerTable({ customers, loading, onDelete, onCreateClick }: CustomerTableProps) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortAsc, setSortAsc] = useState(false)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      (c.customer_number ?? '').toLowerCase().includes(q) ||
      (c.contact_name ?? '').toLowerCase().includes(q) ||
      (c.contact_email ?? '').toLowerCase().includes(q)
    )
  })

  const sorted = [...filtered].sort((a, b) => {
    const av = (a[sortKey] ?? '') as string
    const bv = (b[sortKey] ?? '') as string
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
        <p className="text-sm text-muted-foreground">Loading customers...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <button
          onClick={onCreateClick}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Customer
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {search ? 'No customers match your search.' : 'No customers yet. Create your first customer above.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                {[
                  { key: 'customer_number' as SortKey, label: '#' },
                  { key: 'name' as SortKey, label: 'Name' },
                  { key: 'customer_type' as SortKey, label: 'Type' },
                  { key: 'tier' as SortKey, label: 'Tier' },
                  { key: 'status' as SortKey, label: 'Status' },
                ].map((col) => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className="cursor-pointer px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      <ArrowUpDown className="h-3 w-3" />
                    </span>
                  </th>
                ))}
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Contact</th>
                <th className="w-10 px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{c.customer_number}</td>
                  <td className="px-4 py-2.5">
                    <Link href={`/org/customers/${c.id}`} className="font-medium text-foreground hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.customer_type ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    {c.tier ? (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">{c.tier}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                      c.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-500/10 text-zinc-400'
                    }`}>
                      {c.status ?? 'active'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {c.contact_name && <div>{c.contact_name}</div>}
                    {c.contact_email && <div>{c.contact_email}</div>}
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="relative">
                      <button
                        onClick={() => setMenuOpen(menuOpen === c.id ? null : c.id)}
                        className="rounded p-1 hover:bg-muted"
                      >
                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                      </button>
                      {menuOpen === c.id && (
                        <div className="absolute right-0 z-10 mt-1 w-36 rounded-md border border-border bg-card py-1 shadow-md">
                          <Link
                            href={`/org/customers/${c.id}`}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted"
                            onClick={() => setMenuOpen(null)}
                          >
                            <ExternalLink className="h-3 w-3" /> View Detail
                          </Link>
                          <button
                            onClick={() => { onDelete(c.id); setMenuOpen(null) }}
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
