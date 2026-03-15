'use client'

import { FolderKanban, BarChart3, Clock, FileDiff, ListChecks, CalendarDays, MapPin, HardHat } from 'lucide-react'
import { DashboardWidget } from '@/components/shared/DashboardWidget'
import { DashboardWelcome } from '@/components/shared/DashboardWelcome'
import { useUser } from '@/hooks/useUser'

const widgets = [
  { label: 'Projects In Progress', icon: FolderKanban, emptyMessage: 'No active projects', description: 'Currently managed projects' },
  { label: 'Project Progress per PN', icon: BarChart3, emptyMessage: 'No project data yet', description: 'Completion status by project number' },
  { label: 'Waiting On', icon: Clock, emptyMessage: 'Nothing pending', description: 'Items awaiting external action' },
  { label: 'Change Orders', icon: FileDiff, emptyMessage: 'No change orders', description: 'Active change orders across projects' },
  { label: 'Action Items', icon: ListChecks, emptyMessage: 'No action items', description: 'Tasks requiring your attention' },
  { label: 'Calendar', icon: CalendarDays, emptyMessage: 'No upcoming events', description: 'Milestones and deadlines' },
  { label: 'Sub Locations', icon: MapPin, emptyMessage: 'No active sub assignments', description: 'PN / Location per subcontractor' },
  { label: 'Installer Locations', icon: HardHat, emptyMessage: 'No active installer assignments', description: 'PN / Location per installer' },
] as const

interface PMDashboardProps {
  brandColor?: string | null
  divisionFilter: string
}

export function PMDashboard({ brandColor }: PMDashboardProps) {
  const { user } = useUser()

  return (
    <div className="space-y-6">
      <DashboardWelcome title="Project Manager Dashboard" subtitle="Your projects and field operations" firstName={user?.first_name} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {widgets.map((w) => (
          <DashboardWidget key={w.label} label={w.label} icon={w.icon} emptyMessage={w.emptyMessage} description={w.description} brandColor={brandColor} />
        ))}
      </div>
    </div>
  )
}
