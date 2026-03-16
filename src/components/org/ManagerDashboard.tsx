'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Briefcase, Send, Trophy, FolderKanban, FolderCheck,
  Clock, FileDiff, ListChecks, CalendarDays, BarChart3,
  Building2, Users, Wrench,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { DashboardWidget } from '@/components/shared/DashboardWidget'

const placeholderWidgets = [
  { label: 'OPPs In Progress', icon: Briefcase, emptyMessage: 'No active opportunities', description: 'Opportunities currently being worked' },
  { label: 'OPPs Submitted', icon: Send, emptyMessage: 'No submitted opportunities', description: 'Per-user submission count' },
  { label: 'OPPs Won', icon: Trophy, emptyMessage: 'No won opportunities yet', description: 'Per user / per month / per year' },
  { label: 'Projects In Progress', icon: FolderKanban, emptyMessage: 'No active projects', description: 'Currently running projects' },
  { label: 'Projects Closed', icon: FolderCheck, emptyMessage: 'No closed projects yet', description: 'Per year / per month / per user' },
  { label: 'OPPs Waiting On', icon: Clock, emptyMessage: 'Nothing pending', description: 'Items awaiting action' },
  { label: 'Change Orders', icon: FileDiff, emptyMessage: 'No change orders', description: 'Active change orders across projects' },
  { label: 'Action Items', icon: ListChecks, emptyMessage: 'No action items', description: 'Tasks requiring your attention' },
  { label: 'Calendar', icon: CalendarDays, emptyMessage: 'No upcoming events', description: 'Scheduled meetings and milestones' },
  { label: 'KPIs', icon: BarChart3, emptyMessage: 'No KPI data yet', description: 'Per-user performance metrics' },
] as const

interface ManagerDashboardProps {
  brandColor?: string | null
  divisionFilter: string
}

export function ManagerDashboard({ brandColor }: ManagerDashboardProps) {
  const [stats, setStats] = useState({ customers: 0, vendors: 0, subcontractors: 0 })
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const customersRes = await supabase.from('customers').select('id', { count: 'exact', head: true })
    const vendorsRes = await supabase.from('vendors').select('id', { count: 'exact', head: true })
    const subsRes = await supabase.from('subcontractors').select('id', { count: 'exact', head: true })
    setStats({
      customers: customersRes.count ?? 0,
      vendors: vendorsRes.count ?? 0,
      subcontractors: subsRes.count ?? 0,
    })
    setLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => { void loadData() }, 0)
    return () => clearTimeout(t)
  }, [loadData])

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-medium text-foreground">Manager Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DashboardWidget label="Customers" icon={Users} value={stats.customers} description="Customer accounts" loading={loading} brandColor={brandColor} />
        <DashboardWidget label="Vendors" icon={Building2} value={stats.vendors} description="Vendor relationships" loading={loading} brandColor={brandColor} />
        <DashboardWidget label="Subcontractors" icon={Wrench} value={stats.subcontractors} description="Subcontractor partners" loading={loading} brandColor={brandColor} />
        {placeholderWidgets.map((w) => (
          <DashboardWidget key={w.label} label={w.label} icon={w.icon} emptyMessage={w.emptyMessage} description={w.description} brandColor={brandColor} />
        ))}
      </div>
    </div>
  )
}
