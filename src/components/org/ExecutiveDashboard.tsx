'use client'

import { useEffect, useState } from 'react'
import { DashboardWidget } from '@/components/shared/DashboardWidget'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Target,
  FolderKanban,
  AlertTriangle,
  TicketCheck,
  ShieldAlert,
  Award,
  Users,
  Receipt,
  Repeat,
} from 'lucide-react'

interface Props {
  brandColor: string | null
  divisionFilter: string
}

interface DashboardData {
  open_opps: number
  open_opps_value: number
  won_this_month: number
  lost_this_month: number
  active_projects: number
  at_risk_projects: number
  open_tickets: number
  sla_breached: number
  expired_licenses: number
  expired_certs: number
  subs_on_hold: number
  outstanding_ar: number
  mrr: number
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toLocaleString()}`
}

export function ExecutiveDashboard({ brandColor, divisionFilter }: Props) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function fetchData() {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (divisionFilter && divisionFilter !== 'ALL') params.set('division', divisionFilter)
        const res = await fetch(`/api/org/dashboard/executive?${params.toString()}`)
        if (res.ok && !cancelled) {
          setData(await res.json())
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [divisionFilter])

  const winRate = data && (data.won_this_month + data.lost_this_month > 0)
    ? Math.round((data.won_this_month / (data.won_this_month + data.lost_this_month)) * 100)
    : 0

  return (
    <div className="space-y-1">
      {/* Revenue Pipeline */}
      <SectionHeader label="Revenue Pipeline" />
      <div className="grid grid-cols-4 gap-4">
        <DashboardWidget
          label="Open Pipeline"
          icon={DollarSign}
          value={data?.open_opps ?? null}
          description={data ? formatCurrency(data.open_opps_value) : undefined}
          loading={loading}
          brandColor={brandColor}
          accentIndex={0}
        />
        <DashboardWidget
          label="Won This Month"
          icon={TrendingUp}
          value={data?.won_this_month ?? null}
          loading={loading}
          brandColor={brandColor}
          accentIndex={1}
        />
        <DashboardWidget
          label="Lost This Month"
          icon={TrendingDown}
          value={data?.lost_this_month ?? null}
          loading={loading}
          brandColor={brandColor}
          accentIndex={2}
        />
        <DashboardWidget
          label="Win Rate"
          icon={Target}
          value={winRate}
          description={data ? `${winRate}%` : undefined}
          loading={loading}
          brandColor={brandColor}
          accentIndex={3}
        />
      </div>

      {/* Operations */}
      <SectionHeader label="Operations" />
      <div className="grid grid-cols-4 gap-4">
        <DashboardWidget
          label="Active Projects"
          icon={FolderKanban}
          value={data?.active_projects ?? null}
          loading={loading}
          brandColor={brandColor}
          accentIndex={4}
        />
        <DashboardWidget
          label="At Risk Projects"
          icon={AlertTriangle}
          value={data?.at_risk_projects ?? null}
          loading={loading}
          brandColor={brandColor}
          accentIndex={5}
        />
        <DashboardWidget
          label="Open Tickets"
          icon={TicketCheck}
          value={data?.open_tickets ?? null}
          loading={loading}
          brandColor={brandColor}
          accentIndex={6}
        />
        <DashboardWidget
          label="SLA Breaches"
          icon={ShieldAlert}
          value={data?.sla_breached ?? null}
          loading={loading}
          brandColor={brandColor}
          accentIndex={7}
        />
      </div>

      {/* Compliance */}
      <SectionHeader label="Compliance" />
      <div className="grid grid-cols-3 gap-4">
        <DashboardWidget
          label="Expired Licenses"
          icon={Award}
          value={data?.expired_licenses ?? null}
          loading={loading}
          brandColor={brandColor}
          accentIndex={0}
        />
        <DashboardWidget
          label="Expired Certs"
          icon={ShieldAlert}
          value={data?.expired_certs ?? null}
          loading={loading}
          brandColor={brandColor}
          accentIndex={1}
        />
        <DashboardWidget
          label="Subs on Hold"
          icon={Users}
          value={data?.subs_on_hold ?? null}
          loading={loading}
          brandColor={brandColor}
          accentIndex={2}
        />
      </div>

      {/* Financial */}
      <SectionHeader label="Financial" />
      <div className="grid grid-cols-2 gap-4">
        <DashboardWidget
          label="Outstanding AR"
          icon={Receipt}
          value={data?.outstanding_ar ? Math.round(data.outstanding_ar) : null}
          description={data ? formatCurrency(data.outstanding_ar) : undefined}
          loading={loading}
          brandColor={brandColor}
          accentIndex={3}
        />
        <DashboardWidget
          label="Monthly Recurring Revenue"
          icon={Repeat}
          value={data?.mrr ? Math.round(data.mrr) : null}
          description={data ? formatCurrency(data.mrr) : undefined}
          loading={loading}
          brandColor={brandColor}
          accentIndex={4}
        />
      </div>
    </div>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="mt-6 mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
      {label}
    </p>
  )
}
