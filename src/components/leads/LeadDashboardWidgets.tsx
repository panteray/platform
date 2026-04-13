'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  TrendingUp, DollarSign, Flame, BarChart3,
  Clock, Calendar, Activity, AlertCircle,
} from 'lucide-react'

interface DashboardData {
  total: number
  funnel: Record<string, number>
  pipelineValue: number
  hotLeads: number
  conversionRate: number
  bySource: Record<string, number>
  overdueFollowUps: Array<{ id: string; lead_id: string; follow_up_date: string; follow_up_note: string | null }>
  upcomingMeetings: Array<{ id: string; lead_id: string; title: string; start_time: string; location: string | null }>
  recentActivity: Array<{ id: string; lead_id: string; type: string; subject: string | null; interaction_date: string }>
}

const FUNNEL_ORDER = ['NEW', 'CONTACTED', 'QUALIFYING', 'QUALIFIED', 'CONVERTED', 'ARCHIVED']
const FUNNEL_COLORS: Record<string, string> = {
  NEW: '#3b82f6',
  CONTACTED: '#a855f7',
  QUALIFYING: '#f59e0b',
  QUALIFIED: '#22c55e',
  CONVERTED: '#10b981',
  ARCHIVED: '#a1a1aa',
}

export function LeadDashboardWidgets() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/org/leads/dashboard')
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading dashboard...</p>
      </div>
    )
  }

  if (!data) return null

  const maxFunnel = Math.max(...FUNNEL_ORDER.map((s) => data.funnel[s] ?? 0), 1)

  return (
    <div className="space-y-4">
      {/* Top stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<BarChart3 className="h-4 w-4" />}
          label="Total Leads"
          value={String(data.total)}
          color="#3b82f6"
        />
        <StatCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Pipeline Value"
          value={`$${data.pipelineValue.toLocaleString()}`}
          color="#22c55e"
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Conversion (90d)"
          value={`${data.conversionRate}%`}
          color="#8b5cf6"
        />
        <StatCard
          icon={<Flame className="h-4 w-4" />}
          label="Hot Leads"
          value={String(data.hotLeads)}
          color="#ef4444"
        />
      </div>

      {/* Row 2: Funnel + Source */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Funnel */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lead Funnel</h3>
          <div className="space-y-2">
            {FUNNEL_ORDER.map((status) => {
              const count = data.funnel[status] ?? 0
              const pct = maxFunnel > 0 ? (count / maxFunnel) * 100 : 0
              return (
                <div key={status} className="flex items-center gap-2">
                  <span className="w-20 text-xs text-muted-foreground">{status}</span>
                  <div className="flex-1 h-5 rounded bg-muted/30 overflow-hidden">
                    <div
                      className="h-full rounded transition-all duration-300"
                      style={{ width: `${pct}%`, backgroundColor: FUNNEL_COLORS[status] }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs font-semibold">{count}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Source breakdown */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Leads by Source</h3>
          {Object.keys(data.bySource).length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No source data yet</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(data.bySource)
                .sort((a, b) => b[1] - a[1])
                .map(([source, count]) => {
                  const pct = data.total > 0 ? (count / data.total) * 100 : 0
                  return (
                    <div key={source} className="flex items-center gap-2">
                      <span className="w-28 truncate text-xs text-muted-foreground">
                        {source.replace(/_/g, ' ')}
                      </span>
                      <div className="flex-1 h-4 rounded bg-muted/30 overflow-hidden">
                        <div
                          className="h-full rounded bg-primary/60 transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-xs font-semibold">{count}</span>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Overdue Follow-ups + Upcoming Meetings + Recent Activity */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Overdue follow-ups */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Overdue Follow-Ups</h3>
          </div>
          {data.overdueFollowUps.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">All caught up</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {data.overdueFollowUps.map((f) => (
                <Link
                  key={f.id}
                  href={`/org/leads/${f.lead_id}`}
                  className="flex items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-muted"
                >
                  <span className="truncate text-foreground">{f.follow_up_note ?? 'Follow-up'}</span>
                  <span className="shrink-0 text-[10px] text-amber-500">
                    {new Date(f.follow_up_date).toLocaleDateString()}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming meetings */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-blue-500" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Upcoming Meetings (7d)</h3>
          </div>
          {data.upcomingMeetings.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">No meetings scheduled</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {data.upcomingMeetings.map((m) => (
                <Link
                  key={m.id}
                  href={`/org/leads/${m.lead_id}`}
                  className="flex items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-muted"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{m.title}</p>
                    {m.location && <p className="truncate text-[10px] text-muted-foreground">{m.location}</p>}
                  </div>
                  <span className="shrink-0 text-[10px] text-blue-500">
                    {new Date(m.start_time).toLocaleDateString()}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-purple-500" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recent Activity</h3>
          </div>
          {data.recentActivity.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">No activity yet</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {data.recentActivity.map((a) => (
                <Link
                  key={a.id}
                  href={`/org/leads/${a.lead_id}`}
                  className="flex items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-muted"
                >
                  <div className="min-w-0">
                    <span className="rounded bg-muted px-1 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {a.type}
                    </span>
                    {a.subject && <span className="ml-1.5 text-foreground">{a.subject}</span>}
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {new Date(a.interaction_date).toLocaleDateString()}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({
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
