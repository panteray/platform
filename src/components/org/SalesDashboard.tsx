'use client'
import { useEffect, useState, useCallback } from 'react'
import { Briefcase, Send, Trophy, Clock, ListChecks, CalendarDays, Building2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { DashboardWidget } from '@/components/shared/DashboardWidget'

const placeholderWidgets = [
  { label: 'OPPs Submitted', icon: Send, emptyMessage: 'No submitted opportunities', description: 'Proposals awaiting response' },
  { label: 'OPPs Won', icon: Trophy, emptyMessage: 'No won opportunities yet', description: 'By month and year' },
  { label: 'Waiting On', icon: Clock, emptyMessage: 'Nothing pending', description: 'Items awaiting external action' },
  { label: 'Action Items', icon: ListChecks, emptyMessage: 'No action items', description: 'Tasks requiring your attention' },
  { label: 'Calendar', icon: CalendarDays, emptyMessage: 'No upcoming events', description: 'Scheduled meetings and milestones' },
] as const

interface SalesDashboardProps { brandColor?: string | null; divisionFilter: string }

export function SalesDashboard({ brandColor }: SalesDashboardProps) {
  const [stats, setStats] = useState({ opportunities: 0, customers: 0 })
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const oppsRes = await supabase.from('opportunities').select('id', { count: 'exact', head: true })
    const custRes = await supabase.from('customers').select('id', { count: 'exact', head: true })
    setStats({ opportunities: oppsRes.count ?? 0, customers: custRes.count ?? 0 })
    setLoading(false)
  }, [])

  useEffect(() => { const t = setTimeout(() => { void loadData() }, 0); return () => clearTimeout(t) }, [loadData])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Sales Dashboard</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">Pipeline and customer activity</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <DashboardWidget label="OPPs In Progress" icon={Briefcase} value={stats.opportunities} description="Total pipeline opportunities" loading={loading} brandColor={brandColor} accentIndex={0} />
        <DashboardWidget label="Customers" icon={Building2} value={stats.customers} description="Customer accounts" loading={loading} brandColor={brandColor} accentIndex={3} />
        {placeholderWidgets.map((w, i) => (
          <DashboardWidget key={w.label} label={w.label} icon={w.icon} emptyMessage={w.emptyMessage} description={w.description} brandColor={brandColor} accentIndex={i + 1} />
        ))}
      </div>
    </div>
  )
}
