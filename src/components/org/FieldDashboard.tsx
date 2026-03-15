'use client'

import { CalendarDays, CalendarClock, ListChecks, MapPin, FolderKanban } from 'lucide-react'
import { DashboardWidget } from '@/components/shared/DashboardWidget'
import { DashboardWelcome } from '@/components/shared/DashboardWelcome'
import { useUser } from '@/hooks/useUser'
import { UserRole } from '@/types/enums'

interface FieldDashboardProps {
  brandColor?: string | null
  divisionFilter: string
}

export function FieldDashboard({ brandColor }: FieldDashboardProps) {
  const { user, userRole } = useUser()
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
      <DashboardWelcome
        title={isLead ? 'Field Lead Dashboard' : 'Field Tech Dashboard'}
        subtitle={isLead ? 'Your team and field operations' : 'Your daily assignments'}
        firstName={user?.first_name}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {widgets.map((w) => (
          <DashboardWidget key={w.label} label={w.label} icon={w.icon} emptyMessage={w.emptyMessage} description={w.description} brandColor={brandColor} />
        ))}
      </div>
    </div>
  )
}
