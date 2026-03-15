'use client'

import { useEffect, useState, useCallback } from 'react'
import { Users, Briefcase, Send, Trophy, Clock, ListChecks, CalendarDays } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { DashboardWidget } from '@/components/shared/DashboardWidget'

interface SalesDashboardProps {
  brandColor?: string | null
  divisionFilter: string
}

export function SalesDashboard({ brandColor }: SalesDashboardProps) {
  const [customerCount, setCustomerCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { count } = await supabase.from('customers').select('id', { count: 'exact', head: true })
    setCustomerCount(count ?? 0)
    setLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => { void loadData() }, 0)
    return () => clearTimeout(t)
  }, [loadData])

  const placeholderWidgets = [
    { label: 'OPPs In Progress', icon: Briefcase, emptyMessage: 'No active opportunities', description: 'Your current opportunities' },
    { label: 'OPPs Submitted', icon: Send, emptyMessage: 'No submitted opportunities', description: 'Proposals awaiting response' },
    { label: 'OPPs Won', icon: Trophy, emptyMessage: 'No won opportunities yet', description: 'By month and year' },
    { label: 'Waiting On', icon: Clock, emptyMessage: 'Nothing pending', description: 'Items awaiting external action' },
    { label: 'Action Items', icon: ListChecks, emptyMessage: 'No action items', description: 'Tasks requiring your attention' },
    { label: 'Calendar', icon: CalendarDays, emptyMessage: 'No upcoming events', description: 'Meetings and follow-ups' },
  ] as const

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-medium text-foreground">Sales Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DashboardWidget
          label="Customer Status"
          icon={Users}
          value={customerCount ?? undefined}
          description="Active customer accounts"
          emptyMessage={customerCount === 0 ? 'No customers yet' : undefined}
          loading={loading}
          brandColor={brandColor}
        />
        {placeholderWidgets.map((w) => (
          <DashboardWidget key={w.label} label={w.label} icon={w.icon} emptyMessage={w.emptyMessage} description={w.description} brandColor={brandColor} />
        ))}
      </div>
    </div>
  )
}
