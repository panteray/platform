'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { Clock, TrendingUp, DollarSign, AlertCircle, ArrowUpDown, FolderKanban, Ticket } from 'lucide-react'
import type { PsaTicketCosting, PsaPriority, PsaTicketStatus, PsaProjectCosting } from '@/types/database'

type Row = PsaTicketCosting & {
  priority: PsaPriority
  status: PsaTicketStatus
}

type WipScope = 'tickets' | 'projects'

type SortKey = 'budget_burn_pct' | 'gross_margin' | 'gm_pct' | 'total_revenue' | 'total_cost' | 'actual_hours' | 'ticket_number'
type SortDir = 'asc' | 'desc'

const PRIORITY_COLORS: Record<PsaPriority, string> = {
  P1: 'bg-red-600 text-white',
  P2: 'bg-orange-500 text-white',
  P3: 'bg-amber-400 text-amber-900',
  P4: 'bg-blue-400 text-white',
  P5: 'bg-neutral-300 text-neutral-700',
}

export default function WipReportView() {
  const [scope, setScope] = useState<WipScope>('tickets')
  const [rows, setRows] = useState<Row[]>([])
  const [projectRows, setProjectRows] = useState<PsaProjectCosting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('budget_burn_pct')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  useEffect(() => {
    setLoading(true)
    setError(null)
    const url = scope === 'tickets' ? '/api/org/psa/reports/wip' : '/api/org/psa/reports/wip/projects'
    fetch(url)
      .then(r => r.ok ? r.json() : r.json().then(d => { throw new Error(d.error || 'Failed') }))
      .then(d => {
        if (scope === 'tickets') setRows(d)
        else setProjectRows(d)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [scope])

  const sorted = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      const av = (a[sortKey] as number | string | null) ?? -Infinity
      const bv = (b[sortKey] as number | string | null) ?? -Infinity
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return copy
  }, [rows, sortKey, sortDir])

  function toggleSort(k: SortKey) {
    if (sortKey === k) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(k)
      setSortDir('desc')
    }
  }

  // Totals — scope-aware
  const totals = useMemo(() => {
    if (scope === 'projects') {
      return {
        count: projectRows.length,
        cost: projectRows.reduce((s, r) => s + (r.total_cost ?? 0), 0),
        revenue: projectRows.reduce((s, r) => s + (r.total_revenue ?? 0), 0),
        margin: projectRows.reduce((s, r) => s + (r.gross_margin ?? 0), 0),
        hours: projectRows.reduce((s, r) => s + (r.actual_hours ?? 0), 0),
      }
    }
    return {
      count: rows.length,
      cost: rows.reduce((s, r) => s + (r.total_cost ?? 0), 0),
      revenue: rows.reduce((s, r) => s + (r.total_revenue ?? 0), 0),
      margin: rows.reduce((s, r) => s + (r.gross_margin ?? 0), 0),
      hours: rows.reduce((s, r) => s + (r.actual_hours ?? 0), 0),
    }
  }, [rows, projectRows, scope])

  // Sort projects (simpler — no sort headers for now; default burn desc handled by API)
  const sortedProjects = useMemo(() => {
    const copy = [...projectRows]
    copy.sort((a, b) => (b.budget_burn_pct ?? -1) - (a.budget_burn_pct ?? -1))
    return copy
  }, [projectRows])

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Work In Progress</h1>
        <p className="text-sm text-neutral-500 mt-1">
          {scope === 'tickets'
            ? 'Open tickets with costing enabled. Sort by budget burn to spot runaway jobs.'
            : 'Projects rolled up from costing-enabled tickets. Sort by budget burn to spot runaway jobs.'}
        </p>
      </div>

      {/* Scope toggle */}
      <div className="inline-flex rounded-lg border border-neutral-200 bg-white p-0.5">
        <button
          onClick={() => setScope('tickets')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            scope === 'tickets' ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <Ticket className="w-3.5 h-3.5" /> Tickets
        </button>
        <button
          onClick={() => setScope('projects')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            scope === 'projects' ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <FolderKanban className="w-3.5 h-3.5" /> Projects
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard label={scope === 'tickets' ? 'Open Tickets' : 'Projects'} value={totals.count.toString()} icon={scope === 'tickets' ? <Clock className="w-4 h-4" /> : <FolderKanban className="w-4 h-4" />} />
        <SummaryCard label="Actual Hours" value={`${totals.hours.toFixed(1)}h`} icon={<Clock className="w-4 h-4" />} />
        <SummaryCard label="Total Cost" value={money(totals.cost)} icon={<DollarSign className="w-4 h-4" />} />
        <SummaryCard label="Total Revenue" value={money(totals.revenue)} icon={<DollarSign className="w-4 h-4" />} />
        <SummaryCard
          label="Gross Margin"
          value={money(totals.margin)}
          icon={<TrendingUp className="w-4 h-4" />}
          tone={totals.margin >= 0 ? 'green' : 'red'}
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-neutral-500">
            <Clock className="w-5 h-5 animate-spin mx-auto mb-2" /> Loading…
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-6 h-6 mx-auto mb-2 text-red-500" />
            <div className="text-sm text-red-700">{error}</div>
          </div>
        ) : scope === 'projects' ? (
          projectRows.length === 0 ? (
            <div className="p-12 text-center text-neutral-500 text-sm">
              No projects with costing-enabled tickets.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-neutral-600 uppercase">Project</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-neutral-600 uppercase">Name</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-neutral-600 uppercase">Status</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-neutral-600 uppercase">Tickets</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-neutral-600 uppercase">Hours</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-neutral-600 uppercase">Burn</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-neutral-600 uppercase">Cost</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-neutral-600 uppercase">Revenue</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-neutral-600 uppercase">Margin</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-neutral-600 uppercase">GM%</th>
                </tr>
              </thead>
              <tbody>
                {sortedProjects.map(p => (
                  <tr key={p.project_id} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link href={`/org/projects/${p.project_id}`} className="text-blue-600 hover:underline">
                        {p.project_number ?? p.project_id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-3 py-2 max-w-xs truncate">{p.project_name}</td>
                    <td className="px-3 py-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-neutral-100 text-neutral-700">{p.project_status}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {p.open_ticket_count}<span className="text-neutral-400"> / {p.ticket_count}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {p.actual_hours.toFixed(1)}
                      {p.estimated_hours ? <span className="text-neutral-400"> / {p.estimated_hours.toFixed(0)}</span> : null}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <BurnPill pct={p.budget_burn_pct} />
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{money(p.total_cost)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{money(p.total_revenue)}</td>
                    <td className={`px-3 py-2 text-right font-mono text-xs ${p.gross_margin >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {money(p.gross_margin)}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono text-xs ${(p.gm_pct ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {p.gm_pct != null ? `${p.gm_pct.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-neutral-500 text-sm">
            No open tickets with costing enabled.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <SortHeader label="Ticket" k="ticket_number" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-600 uppercase">Title</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-600 uppercase">Priority</th>
                <SortHeader label="Hours" k="actual_hours" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                <SortHeader label="Burn" k="budget_burn_pct" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                <SortHeader label="Cost" k="total_cost" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                <SortHeader label="Revenue" k="total_revenue" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                <SortHeader label="Margin" k="gross_margin" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                <SortHeader label="GM%" k="gm_pct" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => (
                <tr key={r.ticket_id} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="px-3 py-2 font-mono text-xs">
                    <Link href={`/org/psa/tickets/${r.ticket_id}`} className="text-blue-600 hover:underline">
                      {r.ticket_number}
                    </Link>
                  </td>
                  <td className="px-3 py-2 max-w-xs truncate">{r.title}</td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${PRIORITY_COLORS[r.priority]}`}>{r.priority}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">
                    {r.actual_hours.toFixed(1)}
                    {r.estimated_hours ? <span className="text-neutral-400"> / {r.estimated_hours}</span> : null}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <BurnPill pct={r.budget_burn_pct} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{money(r.total_cost)}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{money(r.total_revenue)}</td>
                  <td className={`px-3 py-2 text-right font-mono text-xs ${r.gross_margin >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {money(r.gross_margin)}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono text-xs ${(r.gm_pct ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {r.gm_pct != null ? `${r.gm_pct.toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function SortHeader({ label, k, sortKey, sortDir, onClick, align = 'left' }: {
  label: string; k: SortKey; sortKey: SortKey; sortDir: SortDir; onClick: (k: SortKey) => void; align?: 'left' | 'right'
}) {
  const active = sortKey === k
  return (
    <th className={`px-3 py-2 text-xs font-medium text-neutral-600 uppercase cursor-pointer select-none ${align === 'right' ? 'text-right' : 'text-left'}`} onClick={() => onClick(k)}>
      <span className={`inline-flex items-center gap-1 ${active ? 'text-neutral-900' : ''}`}>
        {label}
        <ArrowUpDown className={`w-3 h-3 ${active ? 'opacity-100' : 'opacity-40'}`} />
        {active && <span className="text-[10px]">{sortDir === 'asc' ? '↑' : '↓'}</span>}
      </span>
    </th>
  )
}

function BurnPill({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-neutral-400 text-xs">—</span>
  const tone = pct < 80 ? 'bg-emerald-100 text-emerald-700' : pct <= 100 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${tone}`}>{pct.toFixed(0)}%</span>
}

function SummaryCard({ label, value, icon, tone = 'neutral' }: {
  label: string; value: string; icon: React.ReactNode; tone?: 'neutral' | 'green' | 'red'
}) {
  const toneClass = tone === 'green' ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                 : tone === 'red'   ? 'text-red-700 bg-red-50 border-red-200'
                                    : 'text-neutral-900 bg-white border-neutral-200'
  return (
    <div className={`border rounded-lg p-3 ${toneClass}`}>
      <div className="flex items-center gap-1 text-xs opacity-70 mb-1">{icon}{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  )
}

function money(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}
