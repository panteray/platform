'use client'

import { useEffect, useState, useCallback } from 'react'
import { Briefcase, FolderKanban, Users, Activity } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { DashboardWidget } from '@/components/shared/DashboardWidget'

import { NotificationFeed } from '@/components/org/NotificationFeed'

interface OrgAdminDashboardProps {
  brandColor?: string | null
  divisionFilter: string
}

export function OrgAdminDashboard({ brandColor, divisionFilter }: OrgAdminDashboardProps) {
  
  const [stats, setStats] = useState({ users: 0, opps: 0, projects: 0 })
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const usersRes = await supabase.from('users').select('id', { count: 'exact', head: true })
    const oppsRes = await supabase.from('opportunities').select('id', { count: 'exact', head: true })
    const projectsRes = await supabase.from('projects').select('id', { count: 'exact', head: true })
    setStats({
      users: usersRes.count ?? 0,
      opps: oppsRes.count ?? 0,
      projects: projectsRes.count ?? 0,
    })
    setLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => { void loadData() }, 0)
    return () => clearTimeout(t)
  }, [loadData])

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-medium text-foreground">Organization Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DashboardWidget label="Active Users" icon={Users} value={stats.users} description="Team members in your org" loading={loading} brandColor={brandColor} />
        <DashboardWidget label="Opportunities" icon={Briefcase} value={stats.opps} description="Total pipeline opportunities" loading={loading} brandColor={brandColor} />
        <DashboardWidget label="Projects" icon={FolderKanban} value={stats.projects} description="Active project engagements" loading={loading} brandColor={brandColor} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-[13px] font-semibold text-foreground">Recent Notifications</h2>
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            <NotificationFeed />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-[13px] font-semibold text-foreground">Recent Opportunities</h2>
          </div>
          <div className="flex min-h-[160px] items-center justify-center text-sm text-muted-foreground">
            Coming in Phase 5
          </div>
        </div>
      </div>
    </div>
  )
}
