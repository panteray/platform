'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { Clock, TrendingUp, DollarSign, AlertCircle, ArrowUpDown } from 'lucide-react'
import type { PsaTicketCosting, PsaPriority, PsaTicketStatus } from '@/types/database'

type Row = PsaTicketCosting & {
  priority: PsaPriority
  status: PsaTicketStatus
}

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
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('budget_burn_pct')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  useEffect(() => {
    fetch('/api/org/psa/reports/wip')
      .then(r => r.ok ? r.json() : r.json().then(d => { throw new Error(d.error || 'Failed') }))
      .then(d => setRows(d))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

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

  // Totals
  const totals = useMemo(() => ({
    count: rows.length,
    cost: rows.reduce((s, r) => s + (r.total_cost ?? 0), 0),
    revenue: rows.reduce((s, r) => s + (r.total_revenue ?? 0), 0),
    margin: rows.reduce((s, r) => s + (r.gross_margin ?? 0), 0),
    hours: rows.reduce((s, r) => s + (r.actual_hours ?? 0), 0),
  }), [rows])

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Work In Progress</h1>
        <p className="text-sm text-neutral-500 mt-1">Open tickets with costing enabled. Sort by budget burn to spot runaway jobs.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard label="Open Tickets" value={totals.count.toString()} icon={<Clock className="w-4 h-4" />} />
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
