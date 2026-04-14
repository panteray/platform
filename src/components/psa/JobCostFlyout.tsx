'use client'

import { useState, useEffect } from 'react'
import { X, DollarSign, TrendingUp, TrendingDown, Clock, Package, AlertCircle } from 'lucide-react'
import type { PsaTicketCosting, PsaTimeEntry, PsaTicketPart } from '@/types/database'

type CostingResponse = PsaTicketCosting & {
  time_entries: (PsaTimeEntry & { user?: { id: string; first_name: string | null; last_name: string | null } | null })[]
  parts: PsaTicketPart[]
}

export function JobCostFlyout({ ticketId, open, onClose }: {
  ticketId: string
  open: boolean
  onClose: () => void
}) {
  const [data, setData] = useState<CostingResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [editBudget, setEditBudget] = useState(false)
  const [estHours, setEstHours] = useState('')
  const [estLabor, setEstLabor] = useState('')
  const [estParts, setEstParts] = useState('')
  const [quotedRev, setQuotedRev] = useState('')

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch(`/api/org/psa/tickets/${ticketId}/costing`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setData(d)
          setEstHours(d.estimated_hours != null ? String(d.estimated_hours) : '')
          setEstLabor(d.estimated_labor_cost != null ? String(d.estimated_labor_cost) : '')
          setEstParts(d.estimated_parts_cost != null ? String(d.estimated_parts_cost) : '')
          setQuotedRev(d.quoted_revenue != null ? String(d.quoted_revenue) : '')
        }
        setLoading(false)
      })
  }, [ticketId, open])

  async function saveBudget() {
    await fetch(`/api/org/psa/tickets/${ticketId}/costing`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        estimated_hours: estHours ? parseFloat(estHours) : null,
        estimated_labor_cost: estLabor ? parseFloat(estLabor) : null,
        estimated_parts_cost: estParts ? parseFloat(estParts) : null,
        quoted_revenue: quotedRev ? parseFloat(quotedRev) : null,
      }),
    })
    // Refetch
    const res = await fetch(`/api/org/psa/tickets/${ticketId}/costing`)
    if (res.ok) setData(await res.json())
    setEditBudget(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative w-full max-w-2xl bg-white shadow-2xl overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-neutral-200 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-semibold">Job Costing</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-neutral-100 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading || !data ? (
          <div className="p-12 text-center text-sm text-neutral-500">
            <Clock className="w-5 h-5 animate-spin mx-auto mb-2" /> Loading…
          </div>
        ) : (
          <div className="p-6 space-y-6">
            <div>
              <div className="text-xs text-neutral-500 mb-1">{data.ticket_number}</div>
              <div className="text-base font-medium">{data.title}</div>
            </div>

            {/* Budget burn indicator */}
            {data.budget_burn_pct != null && (
              <BudgetBurnBar pct={data.budget_burn_pct} />
            )}

            {/* Totals grid */}
            <div className="grid grid-cols-2 gap-3">
              <MetricCard
                label="Total Cost"
                value={money(data.total_cost)}
                sublabel={`labor ${money(data.actual_labor_cost)} + parts ${money(data.actual_parts_cost)}`}
                tone="neutral"
              />
              <MetricCard
                label="Total Revenue"
                value={money(data.total_revenue)}
                sublabel={data.quoted_revenue ? `quoted ${money(data.quoted_revenue)}` : 'no quote'}
                tone="neutral"
              />
              <MetricCard
                label="Gross Margin"
                value={money(data.gross_margin)}
                sublabel={data.gm_pct != null ? `${data.gm_pct.toFixed(1)}%` : '—'}
                tone={data.gross_margin >= 0 ? 'green' : 'red'}
                icon={data.gross_margin >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              />
              <MetricCard
                label="Actual Hours"
                value={`${data.actual_hours.toFixed(1)}h`}
                sublabel={data.estimated_hours ? `est ${data.estimated_hours}h` : 'no estimate'}
                tone="neutral"
                icon={<Clock className="w-4 h-4" />}
              />
            </div>

            {/* Budget estimates */}
            <Section title="Budget Estimates" onEdit={() => setEditBudget(!editBudget)} editing={editBudget}>
              {editBudget ? (
                <div className="grid grid-cols-2 gap-3">
                  <LabelInput label="Estimated Hours" value={estHours} onChange={setEstHours} type="number" />
                  <LabelInput label="Quoted Revenue" value={quotedRev} onChange={setQuotedRev} type="number" />
                  <LabelInput label="Est. Labor Cost" value={estLabor} onChange={setEstLabor} type="number" />
                  <LabelInput label="Est. Parts Cost" value={estParts} onChange={setEstParts} type="number" />
                  <div className="col-span-2 flex justify-end gap-2">
                    <button onClick={() => setEditBudget(false)} className="px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50 rounded">Cancel</button>
                    <button onClick={saveBudget} className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">Save Budget</button>
                  </div>
                </div>
              ) : (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div><dt className="text-neutral-500 text-xs">Hours</dt><dd>{data.estimated_hours ?? '—'}</dd></div>
                  <div><dt className="text-neutral-500 text-xs">Quoted Revenue</dt><dd>{data.quoted_revenue != null ? money(data.quoted_revenue) : '—'}</dd></div>
                  <div><dt className="text-neutral-500 text-xs">Labor Cost</dt><dd>{data.estimated_labor_cost != null ? money(data.estimated_labor_cost) : '—'}</dd></div>
                  <div><dt className="text-neutral-500 text-xs">Parts Cost</dt><dd>{data.estimated_parts_cost != null ? money(data.estimated_parts_cost) : '—'}</dd></div>
                </dl>
              )}
            </Section>

            {/* Labor breakdown */}
            <Section title={`Labor (${data.time_entries.length})`}>
              {data.time_entries.length === 0 ? (
                <div className="text-xs text-neutral-400 py-3">No time logged</div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-neutral-500 border-b border-neutral-200">
                      <th className="py-1.5 font-medium">Date</th>
                      <th className="py-1.5 font-medium">User</th>
                      <th className="py-1.5 font-medium text-right">Hours</th>
                      <th className="py-1.5 font-medium text-right">Rate</th>
                      <th className="py-1.5 font-medium">Bill.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.time_entries.map(e => {
                      const name = `${e.user?.first_name ?? ''} ${e.user?.last_name ?? ''}`.trim() || '—'
                      return (
                        <tr key={e.id} className="border-b border-neutral-100">
                          <td className="py-1.5 font-mono">{e.entry_date}</td>
                          <td className="py-1.5">{name}</td>
                          <td className="py-1.5 font-mono text-right">{Number(e.hours).toFixed(2)}</td>
                          <td className="py-1.5 font-mono text-right">{e.rate != null ? money(Number(e.rate)) : '—'}</td>
                          <td className="py-1.5">{e.billable ? '✓' : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </Section>

            {/* Parts breakdown */}
            <Section title={`Parts (${data.parts.length})`}>
              {data.parts.length === 0 ? (
                <div className="text-xs text-neutral-400 py-3">No parts logged</div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-neutral-500 border-b border-neutral-200">
                      <th className="py-1.5 font-medium">Part #</th>
                      <th className="py-1.5 font-medium">Description</th>
                      <th className="py-1.5 font-medium text-right">Qty</th>
                      <th className="py-1.5 font-medium text-right">Cost</th>
                      <th className="py-1.5 font-medium text-right">Markup</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.parts.map(p => (
                      <tr key={p.id} className="border-b border-neutral-100">
                        <td className="py-1.5 font-mono">{p.part_number ?? '—'}</td>
                        <td className="py-1.5">{p.description}</td>
                        <td className="py-1.5 font-mono text-right">{p.quantity}</td>
                        <td className="py-1.5 font-mono text-right">{p.cost != null ? money(Number(p.cost)) : '—'}</td>
                        <td className="py-1.5 font-mono text-right">{p.markup_pct != null ? `${p.markup_pct}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>

            {!data.costing_enabled && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded text-xs">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-amber-900">Costing disabled</div>
                  <div className="text-amber-700 mt-0.5">Enable costing on this ticket to include it in WIP reports.</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function BudgetBurnBar({ pct }: { pct: number }) {
  const clamped = Math.min(Math.max(pct, 0), 150)
  const tone = pct < 80 ? 'bg-emerald-500' : pct <= 100 ? 'bg-amber-500' : 'bg-red-500'
  const toneText = pct < 80 ? 'text-emerald-700' : pct <= 100 ? 'text-amber-700' : 'text-red-700'
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-neutral-500">Budget Burn</span>
        <span className={`font-semibold ${toneText}`}>{pct.toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
        <div className={tone} style={{ width: `${(clamped / 150) * 100}%`, height: '100%' }} />
      </div>
      <div className="flex justify-between text-[10px] text-neutral-400 mt-0.5">
        <span>0%</span><span>80%</span><span>100%</span><span>150%</span>
      </div>
    </div>
  )
}

function MetricCard({ label, value, sublabel, tone, icon }: {
  label: string; value: string; sublabel?: string; tone: 'neutral' | 'green' | 'red'; icon?: React.ReactNode
}) {
  const toneClass = tone === 'green' ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                   : tone === 'red'   ? 'text-red-700 bg-red-50 border-red-200'
                                      : 'text-neutral-900 bg-white border-neutral-200'
  return (
    <div className={`border rounded p-3 ${toneClass}`}>
      <div className="flex items-center gap-1 text-xs mb-1 opacity-70">{icon}{label}</div>
      <div className="text-lg font-semibold">{value}</div>
      {sublabel && <div className="text-[10px] opacity-70 mt-0.5">{sublabel}</div>}
    </div>
  )
}

function Section({ title, children, onEdit, editing }: {
  title: string; children: React.ReactNode; onEdit?: () => void; editing?: boolean
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">{title}</h3>
        {onEdit && !editing && (
          <button onClick={onEdit} className="text-xs text-blue-600 hover:underline">Edit</button>
        )}
      </div>
      {children}
    </div>
  )
}

function LabelInput({ label, value, onChange, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string
}) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-neutral-500 uppercase mb-0.5">{label}</label>
      <input
        type={type}
        step="0.01"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-2 py-1 border border-neutral-300 rounded text-sm"
      />
    </div>
  )
}

function money(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}
