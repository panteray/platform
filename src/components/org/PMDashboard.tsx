'use client'

import { FolderKanban, BarChart3, Clock, FileDiff, ListChecks, CalendarDays, MapPin, HardHat } from 'lucide-react'
import { DashboardWidget } from '@/components/shared/DashboardWidget'


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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Project Manager Dashboard</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Project execution and field coordination</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {widgets.map((w, i) => (
          <DashboardWidget key={w.label} label={w.label} icon={w.icon} emptyMessage={w.emptyMessage} description={w.description} brandColor={brandColor} accentIndex={i} />
        ))}
      </div>
    </div>
  )
}
