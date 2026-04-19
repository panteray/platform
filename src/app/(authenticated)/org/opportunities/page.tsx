'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Search, Briefcase, List, Columns3, BarChart3 } from 'lucide-react'
import { useOpportunities } from '@/hooks/useOpportunities'
import { useUser } from '@/hooks/useUser'
import { OppKanban } from '@/components/opportunities/OppKanban'
import { OppDashboard } from '@/components/opportunities/OppDashboard'
import { OPP_STATUS_LABELS, OppType } from '@/types/enums'
import type { Opportunity } from '@/types/database'

type PageView = 'table' | 'kanban' | 'dashboard'

const VIEW_TABS: { key: PageView; label: string; icon: typeof List }[] = [
  { key: 'table', label: 'Table', icon: List },
  { key: 'kanban', label: 'Kanban', icon: Columns3 },
  { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
]

export default function OpportunitiesPage() {
  const router = useRouter()
  const { opportunities, loading } = useOpportunities()
  const { user } = useUser()
  const [search, setSearch] = useState('')
  const [pageView, setPageView] = useState<PageView>('table')
  const [filterType, setFilterType] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let list = opportunities
    if (filterType) list = list.filter((o) => o.opp_type === filterType)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((o) =>
        (o.opp_number ?? '').toLowerCase().includes(q) ||
        (o.project_name ?? '').toLowerCase().includes(q) ||
        ((((o as unknown as Record<string, unknown>).customers) as { name?: string } | null)?.name ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [opportunities, search, filterType])

  if (loading) return <div className="flex h-64 items-center justify-center"><p className="text-sm text-muted-foreground">Loading opportunities...</p></div>

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div><h1 className="font-display text-2xl font-bold tracking-tight">Opportunities</h1><p className="text-sm text-muted-foreground">{opportunities.length} opportunities in pipeline</p></div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex rounded-lg border border-border bg-muted/40 p-0.5">
            {VIEW_TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setPageView(key)}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  pageView === key
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
          {pageView !== 'dashboard' && (
            <Link href="/org/opportunities/create" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" />New Opportunity</Link>
          )}
        </div>
      </div>

      {pageView === 'dashboard' && <OppDashboard />}

      {pageView === 'kanban' && <OppKanban opportunities={filtered} loading={loading} />}

      {pageView === 'table' && <>
      {/* Discipline filter */}
      <div className="flex flex-wrap gap-1.5">
        {Object.values(OppType).map((t) => (
          <button key={t} onClick={() => setFilterType(filterType === t ? null : t)} className={`rounded-full border px-3 py-0.5 text-xs font-semibold transition-colors ${filterType === t ? 'border-primary bg-primary text-white' : 'border-border text-muted-foreground hover:bg-muted'}`}>{t}</button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Search by OPP#, project name, customer..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <Briefcase className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">{search || filterType ? 'No opportunities match your filters.' : 'No opportunities yet.'}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">OPP #</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Customer</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Type</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Project Name</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Vertical</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Updated</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const cust = ((o as unknown as Record<string, unknown>).customers) as { id: string; name: string } | null
                return (
                  <tr key={o.id} className="border-b border-border last:border-0 hover:bg-muted/20 cursor-pointer" onClick={() => router.push(`/org/opportunities/${o.id}`)}>
                    <td className="px-3 py-2 font-mono text-xs font-medium">{o.opp_number}</td>
                    <td className="px-3 py-2">{cust?.name ?? '—'}</td>
                    <td className="px-3 py-2">{o.opp_type ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded border border-border">{o.opp_type}</span> : '—'}</td>
                    <td className="px-3 py-2"><span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">{(OPP_STATUS_LABELS[o.status as keyof typeof OPP_STATUS_LABELS] ?? o.status).replace(/_/g, ' ')}</span></td>
                    <td className="px-3 py-2 text-muted-foreground">{o.project_name ?? '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{o.customer_vertical ?? '—'}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{o.updated_at ? new Date(o.updated_at).toLocaleDateString() : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      </>}
    </div>
  )
}
