'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Activity, Building2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { DashboardWidget } from '@/components/shared/DashboardWidget'
import { NotificationFeed } from '@/components/org/NotificationFeed'
import type { LucideIcon } from 'lucide-react'

interface WidgetRenderProps {
  brandColor: string | null
  divisionFilter: string
  accentIndex?: number
}

/* ──────────────────────────────────────────────
   STATIC LIVE-COUNT WIDGETS (single supabase count)
   ────────────────────────────────────────────── */

function useCountWidget(table: string) {
  const [count, setCount] = useState<number | null>(0)
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    const supabase = createClient()
    const res = await supabase.from(table).select('id', { count: 'exact', head: true })
    setCount(res.error ? null : (res.count ?? 0))
    setLoading(false)
  }, [table])
  useEffect(() => { void load() }, [load])
  return { count, loading }
}

export function makeCountWidget(label: string, icon: LucideIcon, description: string, table: string) {
  return function CountWidget({ brandColor, accentIndex = 0 }: WidgetRenderProps) {
    const { count, loading } = useCountWidget(table)
    return <DashboardWidget label={label} icon={icon} value={count} description={description} loading={loading} brandColor={brandColor} accentIndex={accentIndex} />
  }
}

export function makeStaticWidget(label: string, icon: LucideIcon, description: string, emptyMessage: string) {
  return function StaticWidget({ brandColor, accentIndex = 0 }: WidgetRenderProps) {
    return <DashboardWidget label={label} icon={icon} emptyMessage={emptyMessage} description={description} brandColor={brandColor} accentIndex={accentIndex} />
  }
}

/* ──────────────────────────────────────────────
   EXECUTIVE WIDGETS (driven by /api/org/dashboard/executive)
   ────────────────────────────────────────────── */

interface ExecData {
  open_opps: number; open_opps_value: number
  won_this_month: number; lost_this_month: number
  active_projects: number; at_risk_projects: number
  open_tickets: number; sla_breached: number
  expired_licenses: number; expired_certs: number; subs_on_hold: number
  outstanding_ar: number; mrr: number
}

const execDataCache: { current: ExecData | null; loadedFor: string | null; pending: Promise<ExecData | null> | null } = {
  current: null, loadedFor: null, pending: null,
}

function fetchExecData(divisionFilter: string): Promise<ExecData | null> {
  if (execDataCache.loadedFor === divisionFilter && execDataCache.current) return Promise.resolve(execDataCache.current)
  if (execDataCache.pending) return execDataCache.pending
  const params = new URLSearchParams()
  if (divisionFilter && divisionFilter !== 'ALL') params.set('division', divisionFilter)
  const p = fetch(`/api/org/dashboard/executive?${params.toString()}`)
    .then(r => r.ok ? r.json() : null)
    .then((d: ExecData | null) => {
      execDataCache.current = d
      execDataCache.loadedFor = divisionFilter
      execDataCache.pending = null
      return d
    })
    .catch(() => { execDataCache.pending = null; return null })
  execDataCache.pending = p
  return p
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toLocaleString()}`
}

export function makeExecWidget(
  label: string,
  icon: LucideIcon,
  pick: (d: ExecData) => { value: number | null; description?: string },
) {
  return function ExecWidget({ brandColor, divisionFilter, accentIndex = 0 }: WidgetRenderProps) {
    const [data, setData] = useState<ExecData | null>(execDataCache.current)
    const [loading, setLoading] = useState(!execDataCache.current)
    useEffect(() => {
      let cancelled = false
      void fetchExecData(divisionFilter).then(d => { if (!cancelled) { setData(d); setLoading(false) } })
      return () => { cancelled = true }
    }, [divisionFilter])
    const picked = data ? pick(data) : { value: null, description: undefined }
    return <DashboardWidget label={label} icon={icon} value={picked.value} description={picked.description} loading={loading} brandColor={brandColor} accentIndex={accentIndex} />
  }
}

export const execPicks = {
  open_pipeline: (d: ExecData) => ({ value: d.open_opps, description: formatCurrency(d.open_opps_value) }),
  won_month: (d: ExecData) => ({ value: d.won_this_month }),
  lost_month: (d: ExecData) => ({ value: d.lost_this_month }),
  win_rate: (d: ExecData) => {
    const total = d.won_this_month + d.lost_this_month
    const r = total > 0 ? Math.round((d.won_this_month / total) * 100) : 0
    return { value: r, description: `${r}%` }
  },
  active_projects: (d: ExecData) => ({ value: d.active_projects }),
  at_risk_projects: (d: ExecData) => ({ value: d.at_risk_projects }),
  open_tickets: (d: ExecData) => ({ value: d.open_tickets }),
  sla_breached: (d: ExecData) => ({ value: d.sla_breached }),
  expired_licenses: (d: ExecData) => ({ value: d.expired_licenses }),
  expired_certs: (d: ExecData) => ({ value: d.expired_certs }),
  subs_on_hold: (d: ExecData) => ({ value: d.subs_on_hold }),
  outstanding_ar: (d: ExecData) => ({ value: d.outstanding_ar ? Math.round(d.outstanding_ar) : null, description: formatCurrency(d.outstanding_ar || 0) }),
  mrr: (d: ExecData) => ({ value: d.mrr ? Math.round(d.mrr) : null, description: formatCurrency(d.mrr || 0) }),
}

/* ──────────────────────────────────────────────
   COMPOSITE WIDGETS
   ────────────────────────────────────────────── */

export function NotificationsWidget() {
  return (
    <div className="h-full overflow-hidden rounded-xl border border-border/40 bg-card shadow-pt-sm">
      <div className="flex items-center gap-2.5 border-b border-border/30 px-4 py-3">
        <Activity className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-[13px] font-semibold text-foreground">Recent Notifications</h2>
      </div>
      <div className="h-[calc(100%-42px)] overflow-y-auto">
        <NotificationFeed />
      </div>
    </div>
  )
}

interface RecentCustomer { id: string; name: string; customer_number: string | null; customer_type: string | null; created_at: string }

export function RecentCustomersWidget() {
  const [customers, setCustomers] = useState<RecentCustomer[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const supabase = createClient()
    supabase.from('customers').select('id, name, customer_number, customer_type, created_at').order('created_at', { ascending: false }).limit(5)
      .then(({ data }) => { setCustomers(data ?? []); setLoading(false) })
  }, [])
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border/40 bg-card shadow-pt-sm">
      <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-[13px] font-semibold text-foreground">Recent Customers</h2>
        </div>
        <Link href="/org/customers" className="text-xs text-pt-purple-light hover:underline">View all</Link>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading...</div>
        ) : customers.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <Building2 className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No customers yet</p>
            <Link href="/org/customers" className="text-xs text-pt-purple-light hover:underline">Create your first customer</Link>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {customers.map((c) => (
              <Link key={c.id} href={`/org/customers/${c.id}`} className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-accent/40">
                <div>
                  <div className="text-sm font-medium text-foreground">{c.name}</div>
                  <div className="text-[11px] text-muted-foreground">{c.customer_number}</div>
                </div>
                {c.customer_type && (
                  <span className="rounded-md bg-pt-purple/10 px-2 py-0.5 text-[10px] font-medium text-pt-purple-light">{c.customer_type}</span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
