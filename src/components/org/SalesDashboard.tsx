'use client'

import { Users, Briefcase, Send, Trophy, Clock, ListChecks, CalendarDays } from 'lucide-react'
import { DashboardWidget } from '@/components/shared/DashboardWidget'


const widgets = [
  { label: 'Customer Status', icon: Users, emptyMessage: 'No customers yet', description: 'Active customer accounts' },
  { label: 'OPPs In Progress', icon: Briefcase, emptyMessage: 'No active opportunities', description: 'Your current opportunities' },
  { label: 'OPPs Submitted', icon: Send, emptyMessage: 'No submitted opportunities', description: 'Proposals awaiting response' },
  { label: 'OPPs Won', icon: Trophy, emptyMessage: 'No won opportunities yet', description: 'By month and year' },
  { label: 'Waiting On', icon: Clock, emptyMessage: 'Nothing pending', description: 'Items awaiting external action' },
  { label: 'Action Items', icon: ListChecks, emptyMessage: 'No action items', description: 'Tasks requiring your attention' },
  { label: 'Calendar', icon: CalendarDays, emptyMessage: 'No upcoming events', description: 'Meetings and follow-ups' },
] as const

interface SalesDashboardProps {
  brandColor?: string | null
  divisionFilter: string
}

export function SalesDashboard({ brandColor }: SalesDashboardProps) {

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-medium text-foreground">Sales Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {widgets.map((w) => (
          <DashboardWidget key={w.label} label={w.label} icon={w.icon} emptyMessage={w.emptyMessage} description={w.description} brandColor={brandColor} />
        ))}
      </div>
    </div>
  )
}
