'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Users, TrendingUp, Clock, Target, AlertTriangle, Trophy,
} from 'lucide-react'

interface TeamPipelineEntry {
  name: string
  total: number
  value: number
  byStatus: Record<string, number>
}

interface ConversionEntry {
  name: string
  total: number
  converted: number
  rate: number
}

interface SourceEntry {
  source: string
  total: number
  converted: number
  rate: number
  value: number
}

interface ManagerData {
  teamPipeline: TeamPipelineEntry[]
  conversionByRep: ConversionEntry[]
  agingBuckets: Record<string, number>
  sourceEffectiveness: SourceEntry[]
  unassignedLeads: number
  leaderboard: ConversionEntry[]
}

const AGING_COLORS: Record<string, string> = {
  '0-7': '#22c55e',
  '8-14': '#84cc16',
  '15-30': '#f59e0b',
  '31-60': '#f97316',
  '60+': '#ef4444',
}

const STATUS_COLORS: Record<string, string> = {
  NEW: '#3b82f6',
  CONTACTED: '#a855f7',
  QUALIFYING: '#f59e0b',
  QUALIFIED: '#22c55e',
  CONVERTED: '#10b981',
  ARCHIVED: '#a1a1aa',
}

export function LeadManagerDashboard() {
  const [data, setData] = useState<ManagerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/org/leads/dashboard-manager')
    if (res.ok) {
      setData(await res.json())
    } else if (res.status === 403) {
      setError(true)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading manager dashboard...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-32 items-center justify-center">
        <p className="text-sm text-muted-foreground">Manager+ access required for this view.</p>
      </div>
    )
  }

  if (!data) return null

  const totalAging = Object.values(data.agingBuckets).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-4">
      {/* Top metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MetricCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Unassigned Leads"
          value={String(data.unassignedLeads)}
          color={data.unassignedLeads > 0 ? '#ef4444' : '#22c55e'}
        />
        <MetricCard
          icon={<Users className="h-4 w-4" />}
          label="Active Reps"
          value={String(data.teamPipeline.filter((t) => t.name !== 'Unassigned').length)}
          color="#3b82f6"
        />
        <MetricCard
          icon={<Target className="h-4 w-4" />}
          label="Total Pipeline"
          value={`$${data.teamPipeline.reduce((s, t) => s + t.value, 0).toLocaleString()}`}
          color="#22c55e"
        />
      </div>

      {/* Row 2: Team Pipeline + Leaderboard */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Team Pipeline */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-blue-500" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Team Lead Pipeline
            </h3>
          </div>
          {data.teamPipeline.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No data</p>
          ) : (
            <div className="space-y-2.5">
              {data.teamPipeline.map((rep) => (
                <div key={rep.name} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{rep.name}</span>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">{rep.total} leads</span>
                      <span className="font-semibold text-emerald-500">
                        ${rep.value.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  {/* Status bar */}
                  <div className="flex h-3 overflow-hidden rounded-sm bg-muted/30">
                    {Object.entries(rep.byStatus).map(([status, count]) => {
                      const pct = rep.total > 0 ? (count / rep.total) * 100 : 0
                      return (
                        <div
                          key={status}
                          className="h-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: STATUS_COLORS[status] ?? '#a1a1aa',
                          }}
                          title={`${status}: ${count}`}
                        />
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Leaderboard */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5 text-amber-500" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Leaderboard (90 Day)
            </h3>
          </div>
          {data.leaderboard.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No conversions yet</p>
          ) : (
            <div className="space-y-1.5">
              {data.leaderboard.map((rep, idx) => (
                <div
                  key={rep.name}
                  className="flex items-center gap-3 rounded-md px-2 py-1.5"
                >
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                    idx === 0 ? 'bg-amber-500/15 text-amber-600' :
                    idx === 1 ? 'bg-gray-400/15 text-gray-500' :
                    idx === 2 ? 'bg-orange-500/15 text-orange-600' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium truncate">{rep.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold">{rep.converted}</span>
                    <span className="text-[10px] text-muted-foreground"> / {rep.total}</span>
                  </div>
                  <span className="w-10 text-right text-xs font-semibold text-emerald-500">
                    {rep.rate}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Conversion by Rep + Lead Aging */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Conversion by Rep */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Conversion Rate by Rep (90d)
            </h3>
          </div>
          {data.conversionByRep.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No data</p>
          ) : (
            <div className="space-y-2">
              {data.conversionByRep.map((rep) => (
                <div key={rep.name} className="flex items-center gap-2">
                  <span className="w-24 truncate text-xs">{rep.name}</span>
                  <div className="flex-1 h-4 rounded bg-muted/30 overflow-hidden">
                    <div
                      className="h-full rounded transition-all duration-300"
                      style={{
                        width: `${rep.rate}%`,
                        backgroundColor: rep.rate >= 30 ? '#22c55e' : rep.rate >= 15 ? '#f59e0b' : '#ef4444',
                      }}
                    />
                  </div>
                  <span className="w-12 text-right text-xs font-semibold">
                    {rep.rate}%
                  </span>
                  <span className="w-12 text-right text-[10px] text-muted-foreground">
                    {rep.converted}/{rep.total}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lead Aging */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-amber-500" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Lead Aging (Active Leads)
            </h3>
          </div>
          <div className="space-y-2">
            {Object.entries(data.agingBuckets).map(([bucket, count]) => {
              const pct = totalAging > 0 ? (count / totalAging) * 100 : 0
              return (
                <div key={bucket} className="flex items-center gap-2">
                  <span className="w-12 text-xs text-muted-foreground">{bucket}d</span>
                  <div className="flex-1 h-5 rounded bg-muted/30 overflow-hidden">
                    <div
                      className="h-full rounded transition-all duration-300"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: AGING_COLORS[bucket] ?? '#a1a1aa',
                      }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs font-semibold">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Row 4: Source Effectiveness */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-purple-500" />
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Source Effectiveness
          </h3>
        </div>
        {data.sourceEffectiveness.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">No data</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Source</th>
                  <th className="pb-2 font-medium text-right">Leads</th>
                  <th className="pb-2 font-medium text-right">Converted</th>
                  <th className="pb-2 font-medium text-right">Rate</th>
                  <th className="pb-2 font-medium text-right">Pipeline Value</th>
                </tr>
              </thead>
              <tbody>
                {data.sourceEffectiveness.map((src) => (
                  <tr key={src.source} className="border-b border-border/50">
                    <td className="py-2 font-medium">{src.source.replace(/_/g, ' ')}</td>
                    <td className="py-2 text-right">{src.total}</td>
                    <td className="py-2 text-right">{src.converted}</td>
                    <td className="py-2 text-right">
                      <span className={
                        src.rate >= 30 ? 'text-emerald-500' :
                        src.rate >= 15 ? 'text-amber-500' : 'text-muted-foreground'
                      }>
                        {src.rate}%
                      </span>
                    </td>
                    <td className="py-2 text-right font-medium">${src.value.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function MetricCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  color: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}15`, color }}
        >
          {icon}
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="text-lg font-bold tracking-tight" style={{ color }}>{value}</p>
        </div>
      </div>
    </div>
  )
}
