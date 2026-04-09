'use client'
import { useEffect, useState, useCallback } from 'react'
import { Briefcase, Clock, Trophy, PenTool, FileDiff, ListChecks, CalendarDays } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { DashboardWidget } from '@/components/shared/DashboardWidget'

const placeholderWidgets = [
  { label: 'OPPs Waiting On', icon: Clock, emptyMessage: 'Nothing pending', description: 'Items awaiting external input' },
  { label: 'OPPs Won', icon: Trophy, emptyMessage: 'No won opportunities yet', description: 'By month and year' },
  { label: 'Designs In Progress', icon: PenTool, emptyMessage: 'No active designs', description: 'System designs currently in work' },
  { label: 'Change Orders', icon: FileDiff, emptyMessage: 'No change orders', description: 'Design-related change orders' },
  { label: 'Action Items', icon: ListChecks, emptyMessage: 'No action items', description: 'Tasks requiring your attention' },
  { label: 'Calendar', icon: CalendarDays, emptyMessage: 'No upcoming events', description: 'Site visits and design reviews' },
] as const

interface PresalesDashboardProps { brandColor?: string | null; divisionFilter: string }

export function PresalesDashboard({ brandColor }: PresalesDashboardProps) {
  const [oppCount, setOppCount] = useState<number | null>(0)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { count, error } = await supabase.from('opportunities').select('id', { count: 'exact', head: true })
    setOppCount(error ? null : (count ?? 0))
    setLoading(false)
  }, [])

  useEffect(() => { const t = setTimeout(() => { void loadData() }, 0); return () => clearTimeout(t) }, [loadData])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Presales Dashboard</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">Design and estimation pipeline overview</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <DashboardWidget label="OPPs In Progress" icon={Briefcase} value={oppCount} description="Opportunities in design" loading={loading} brandColor={brandColor} accentIndex={0} />
        {placeholderWidgets.map((w, i) => (
          <DashboardWidget key={w.label} label={w.label} icon={w.icon} emptyMessage={w.emptyMessage} description={w.description} brandColor={brandColor} accentIndex={i + 1} />
        ))}
      </div>
    </div>
  )
}
