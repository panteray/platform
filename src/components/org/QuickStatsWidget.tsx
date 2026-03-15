'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { useOrgModules } from '@/hooks/useOrgModules'
import { Users, Blocks, Building2 } from 'lucide-react'

export function QuickStatsWidget() {
  const { orgId } = useUser()
  const { enabledModules, loading: modulesLoading } = useOrgModules(orgId)
  const [userCount, setUserCount] = useState<number | null>(null)
  const [orgName, setOrgName] = useState<string | null>(null)

  useEffect(() => {
    if (!orgId) return
    const supabase = createClient()

    async function load() {
      // Get user count for this org
      const { count } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('is_active', true)

      setUserCount(count ?? 0)

      // Get org name
      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', orgId)
        .single()

      setOrgName(org?.name ?? null)
    }

    load()
  }, [orgId])

  if (modulesLoading) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        Loading...
      </div>
    )
  }

  const stats = [
    {
      label: 'Organization',
      value: orgName ?? '...',
      icon: Building2,
    },
    {
      label: 'Active Users',
      value: userCount !== null ? String(userCount) : '...',
      icon: Users,
    },
    {
      label: 'Enabled Modules',
      value: String(enabledModules.length),
      icon: Blocks,
    },
  ]

  return (
    <div className="grid grid-cols-3 gap-3 p-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex flex-col items-center gap-1 rounded-md border border-border bg-muted/30 p-3"
        >
          <stat.icon className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
          <span className="text-base font-semibold text-foreground">{stat.value}</span>
          <span className="text-[10px] text-muted-foreground">{stat.label}</span>
        </div>
      ))}
    </div>
  )
}
