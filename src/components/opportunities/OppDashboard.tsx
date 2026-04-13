'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  TrendingUp, DollarSign, Clock, Target, Users,
  ShieldAlert, BarChart3,
} from 'lucide-react'

interface DashboardData {
  total: number
  active: number
  won: number
  lost: number
  winRate: number
  avgCycleDays: number
  weightedForecast: number
  totalPipelineValue: number
  pendingApprovals: number
  pipelineByStage: { stage: string; count: number; value: number }[]
  byType: { type: string; count: number; value: number }[]
  teamWorkload: { name: string; count: number; value: number }[]
}

const STAGE_COLORS: Record<string, string> = {
  Lead: '#3b82f6',
  Presales: '#8b5cf6',
  Quoting: '#f97316',
  Proposal: '#a855f7',
  Negotiation: '#ec4899',
  Execution: '#22c55e',
  Closeout: '#eab308',
  Won: '#10b981',
  Lost: '#ef4444',
  'On Hold': '#f59e0b',
}

export function OppDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/org/opportunities/dashboard')
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading dashboard...</p>
      </div>
    )
  }

  if (!data) return null

  const maxStageValue = Math.max(...data.pipelineByStage.map((s) => s.value), 1)
  const maxTypeCount = Math.max(...data.byType.map((t) => t.count), 1)
  const maxWorkload = Math.max(...data.teamWorkload.map((t) => t.count), 1)

  return (
    <div className="space-y-4">
      {/* Top metric cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          icon={<BarChart3 className="h-4 w-4" />}
          label="Active Pipeline"
          value={`$${data.totalPipelineValue.toLocaleString()}`}
          sub={`${data.active} active opps`}
          color="#3b82f6"
        />
        <MetricCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Weighted Forecast"
          value={`$${data.weightedForecast.toLocaleString()}`}
          sub="Probability-adjusted"
          color="#22c55e"
        />
        <MetricCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Win Rate (90d)"
          value={`${data.winRate}%`}
          sub={`${data.won} won / ${data.lost} lost`}
          color={data.winRate >= 40 ? '#22c55e' : data.winRate >= 20 ? '#f59e0b' : '#ef4444'}
        />
        <MetricCard
          icon={<Clock className="h-4 w-4" />}
          label="Avg Cycle Time"
          value={`${data.avgCycleDays}d`}
          sub="Create → Complete"
          color="#8b5cf6"
        />
      </div>

      {/* Pending approvals alert */}
      {data.pendingApprovals > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2.5">
          <ShieldAlert className="h-4 w-4 text-amber-500" />
          <span className="text-xs font-medium text-amber-600">
            {data.pendingApprovals} pending approval{data.pendingApprovals > 1 ? 's' : ''} require review
          </span>
        </div>
      )}

      {/* Row 2: Pipeline by Stage + Type Breakdown */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Pipeline by Stage */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5 text-blue-500" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Pipeline by Stage
            </h3>
          </div>
          <div className="space-y-2">
            {data.pipelineByStage.map((s) => {
              const pct = (s.value / maxStageValue) * 100
              const color = STAGE_COLORS[s.stage] ?? '#a1a1aa'
              return (
                <div key={s.stage} className="flex items-center gap-2">
                  <span className="w-20 truncate text-xs">{s.stage}</span>
                  <div className="flex-1 h-5 rounded bg-muted/30 overflow-hidden">
                    <div
                      className="h-full rounded transition-all duration-300"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                  <div className="w-20 text-right">
                    <span className="text-xs font-semibold">${s.value.toLocaleString()}</span>
                  </div>
                  <span className="w-6 text-right text-[10px] text-muted-foreground">{s.count}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Type Breakdown */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-purple-500" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              By Discipline
            </h3>
          </div>
          {data.byType.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No data</p>
          ) : (
            <div className="space-y-2">
              {data.byType.map((t) => {
                const pct = (t.count / maxTypeCount) * 100
                return (
                  <div key={t.type} className="flex items-center gap-2">
                    <span className="w-20 truncate text-xs font-medium">{t.type}</span>
                    <div className="flex-1 h-5 rounded bg-muted/30 overflow-hidden">
                      <div
                        className="h-full rounded bg-purple-500/70 transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-xs font-semibold">{t.count}</span>
                    <span className="w-20 text-right text-[10px] text-muted-foreground">
                      ${t.value.toLocaleString()}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Team Workload */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-blue-500" />
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Team Workload (Active)
          </h3>
        </div>
        {data.teamWorkload.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">No active assignments</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {data.teamWorkload.map((rep) => {
              const pct = (rep.count / maxWorkload) * 100
              return (
                <div key={rep.name} className="flex items-center gap-2">
                  <span className="w-28 truncate text-xs font-medium">{rep.name}</span>
                  <div className="flex-1 h-4 rounded bg-muted/30 overflow-hidden">
                    <div
                      className="h-full rounded bg-blue-500/60 transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-xs font-semibold">{rep.count}</span>
                  <span className="w-20 text-right text-[10px] text-muted-foreground">
                    ${rep.value.toLocaleString()}
                  </span>
                </div>
              )
            })}
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
  sub,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  color: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}15`, color }}
        >
          {icon}
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="text-lg font-bold tracking-tight" style={{ color }}>{value}</p>
          <p className="text-[10px] text-muted-foreground">{sub}</p>
        </div>
      </div>
    </div>
  )
}
