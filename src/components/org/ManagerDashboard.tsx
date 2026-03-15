'use client'

import {
  Briefcase, Send, Trophy, FolderKanban, FolderCheck,
  Clock, FileDiff, ListChecks, CalendarDays, BarChart3,
} from 'lucide-react'
import { DashboardWidget } from '@/components/shared/DashboardWidget'
import { DashboardWelcome } from '@/components/shared/DashboardWelcome'
import { useUser } from '@/hooks/useUser'

const widgets = [
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
  const { user } = useUser()

  return (
    <div className="space-y-6">
      <DashboardWelcome title="Manager Dashboard" subtitle="Organization-wide overview" firstName={user?.first_name} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {widgets.map((w) => (
          <DashboardWidget key={w.label} label={w.label} icon={w.icon} emptyMessage={w.emptyMessage} description={w.description} brandColor={brandColor} />
        ))}
      </div>
    </div>
  )
}
