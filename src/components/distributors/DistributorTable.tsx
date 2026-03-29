'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowUpDown, Plus, Search, MoreHorizontal, Trash2, ExternalLink } from 'lucide-react'
import type { Distributor } from '@/types/database'

interface Props { distributors: Distributor[]; loading: boolean; onDelete: (id: string) => void; onCreateClick: () => void }
type SortKey = 'name' | 'distributor_number' | 'status' | 'rep_name' | 'created_at'

export function DistributorTable({ distributors, loading, onDelete, onCreateClick }: Props) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortAsc, setSortAsc] = useState(false)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const filtered = distributors.filter((d) => { const q = search.toLowerCase(); return d.name.toLowerCase().includes(q) || (d.distributor_number ?? '').toLowerCase().includes(q) || (d.rep_name ?? '').toLowerCase().includes(q) || (d.account_number ?? '').toLowerCase().includes(q) })
  const sorted = [...filtered].sort((a, b) => { const av = (a[sortKey] ?? '') as string; const bv = (b[sortKey] ?? '') as string; const cmp = String(av).localeCompare(String(bv)); return sortAsc ? cmp : -cmp })
  function toggleSort(key: SortKey) { if (sortKey === key) setSortAsc(!sortAsc); else { setSortKey(key); setSortAsc(true) } }

  if (loading) return <div className="flex h-64 items-center justify-center"><p className="text-sm text-muted-foreground">Loading distributors...</p></div>

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input type="text" placeholder="Search distributors..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" /></div>
        <button onClick={onCreateClick} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" />New Distributor</button>
      </div>
      {sorted.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center"><p className="text-sm text-muted-foreground">{search ? 'No distributors match.' : 'No distributors yet.'}</p></div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30"><tr>
              {([['distributor_number','#'],['name','Name'],['status','Status']] as [SortKey,string][]).map(([key,label]) => (<th key={key} onClick={() => toggleSort(key)} className="cursor-pointer px-3 py-2.5 text-left text-xs font-medium text-muted-foreground hover:text-foreground"><span className="inline-flex items-center gap-1">{label}<ArrowUpDown className="h-3 w-3" /></span></th>))}
              <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Account #</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Rep</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Rep Email</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">State</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Preferred</th>
              <th className="w-10 px-2 py-2.5" />
            </tr></thead>
            <tbody>
              {sorted.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{d.distributor_number}</td>
                  <td className="px-3 py-2"><Link href={`/org/distributors/${d.id}`} className="font-medium text-foreground hover:underline">{d.name}</Link></td>
                  <td className="px-3 py-2"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${d.status === 'Active' ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}`}>{d.status ?? '—'}</span></td>
                  <td className="px-3 py-2 text-muted-foreground">{d.account_number ?? '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{d.rep_name ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{d.rep_email ?? '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{d.state ?? '—'}</td>
                  <td className="px-3 py-2">{d.is_preferred ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-green-500/10 text-green-500">Preferred</span> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-2 py-2"><div className="relative"><button onClick={() => setMenuOpen(menuOpen === d.id ? null : d.id)} className="rounded p-1 hover:bg-muted"><MoreHorizontal className="h-4 w-4 text-muted-foreground" /></button>
                    {menuOpen === d.id && (<div className="absolute right-0 z-10 mt-1 w-36 rounded-md border border-border bg-card py-1 shadow-md"><Link href={`/org/distributors/${d.id}`} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted" onClick={() => setMenuOpen(null)}><ExternalLink className="h-3 w-3" /> View</Link><button onClick={() => { onDelete(d.id); setMenuOpen(null) }} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-muted"><Trash2 className="h-3 w-3" /> Delete</button></div>)}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
