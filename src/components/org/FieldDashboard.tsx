'use client'

import { CalendarDays, CalendarClock, ListChecks, MapPin, FolderKanban } from 'lucide-react'
import { DashboardWidget } from '@/components/shared/DashboardWidget'

import { useUser } from '@/hooks/useUser'
import { UserRole } from '@/types/enums'

interface FieldDashboardProps {
  brandColor?: string | null
  divisionFilter: string
}

export function FieldDashboard({ brandColor }: FieldDashboardProps) {
  const { userRole } = useUser()
  const isLead = userRole === UserRole.LEAD

  const widgets = [
    { label: 'Today View', icon: CalendarDays, emptyMessage: 'Nothing scheduled today', description: 'What is scheduled for today' },
    { label: isLead ? 'Upcoming' : 'Upcoming Assignments', icon: CalendarClock, emptyMessage: 'No upcoming assignments', description: 'PN, date, location, customer' },
    { label: 'Calendar', icon: CalendarDays, emptyMessage: 'No upcoming events', description: 'Your field schedule' },
    { label: 'Action Items', icon: ListChecks, emptyMessage: 'No action items', description: 'Tasks requiring your attention' },
    ...(isLead
      ? [{ label: 'Field Tech Locations', icon: MapPin, emptyMessage: 'No active tech assignments', description: 'PN / Location per field tech' }]
      : []),
    { label: isLead ? 'Progress of Assigned Projects' : 'Project Progress', icon: FolderKanban, emptyMessage: 'No assigned projects yet', description: 'Completion status of your assignments' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{isLead ? 'Field Lead Dashboard' : 'Field Tech Dashboard'}</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{isLead ? 'Team assignments and field operations' : 'Your assignments and schedule'}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {widgets.map((w, i) => (
          <DashboardWidget key={w.label} label={w.label} icon={w.icon} emptyMessage={w.emptyMessage} description={w.description} brandColor={brandColor} accentIndex={i} />
        ))}
      </div>
    </div>
  )
}
