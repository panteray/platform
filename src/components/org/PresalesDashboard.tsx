'use client'

import { Briefcase, Clock, Trophy, PenTool, FileDiff, ListChecks, CalendarDays } from 'lucide-react'
import { DashboardWidget } from '@/components/shared/DashboardWidget'
import { DashboardWelcome } from '@/components/shared/DashboardWelcome'
import { useUser } from '@/hooks/useUser'

const widgets = [
  { label: 'OPPs In Progress', icon: Briefcase, emptyMessage: 'No active opportunities', description: 'Opportunities you are designing for' },
  { label: 'OPPs Waiting On', icon: Clock, emptyMessage: 'Nothing pending', description: 'Items awaiting external input' },
  { label: 'OPPs Won', icon: Trophy, emptyMessage: 'No won opportunities yet', description: 'By month and year' },
  { label: 'Designs In Progress', icon: PenTool, emptyMessage: 'No active designs', description: 'System designs currently in work' },
  { label: 'Change Orders', icon: FileDiff, emptyMessage: 'No change orders', description: 'Design-related change orders' },
  { label: 'Action Items', icon: ListChecks, emptyMessage: 'No action items', description: 'Tasks requiring your attention' },
  { label: 'Calendar', icon: CalendarDays, emptyMessage: 'No upcoming events', description: 'Site visits and design reviews' },
] as const

interface PresalesDashboardProps {
  brandColor?: string | null
  divisionFilter: string
}

export function PresalesDashboard({ brandColor }: PresalesDashboardProps) {
  const { user } = useUser()

  return (
    <div className="space-y-6">
      <DashboardWelcome title="Presales Dashboard" subtitle="Design and engineering overview" firstName={user?.first_name} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {widgets.map((w) => (
          <DashboardWidget key={w.label} label={w.label} icon={w.icon} emptyMessage={w.emptyMessage} description={w.description} brandColor={brandColor} />
        ))}
      </div>
    </div>
  )
}
