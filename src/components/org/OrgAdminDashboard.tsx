'use client'

import { useEffect, useState, useCallback } from 'react'
import { Briefcase, FolderKanban, Users, Activity, Building2, Wrench } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { DashboardWidget } from '@/components/shared/DashboardWidget'
import { NotificationFeed } from '@/components/org/NotificationFeed'

interface OrgAdminDashboardProps {
  brandColor?: string | null
  divisionFilter: string
}

interface RecentCustomer {
  id: string
  name: string
  customer_number: string | null
  customer_type: string | null
  created_at: string
}

export function OrgAdminDashboard({ brandColor, divisionFilter }: OrgAdminDashboardProps) {
  const [stats, setStats] = useState({ users: 0, opps: 0, projects: 0, customers: 0, manufacturers: 0, subcontractors: 0, distributors: 0 })
  const [recentCustomers, setRecentCustomers] = useState<RecentCustomer[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const usersRes = await supabase.from('users').select('id', { count: 'exact', head: true })
    const oppsRes = await supabase.from('opportunities').select('id', { count: 'exact', head: true })
    const projectsRes = await supabase.from('projects').select('id', { count: 'exact', head: true })
    const customersRes = await supabase.from('customers').select('id', { count: 'exact', head: true })
    const mfrsRes = await supabase.from('manufacturers').select('id', { count: 'exact', head: true })
    const subsRes = await supabase.from('subcontractors').select('id', { count: 'exact', head: true })
    const distRes = await supabase.from('distributors').select('id', { count: 'exact', head: true })
    const { data: recent } = await supabase
      .from('customers')
      .select('id, name, customer_number, customer_type, created_at')
      .order('created_at', { ascending: false })
      .limit(5)

    setStats({
      users: usersRes.count ?? 0,
      opps: oppsRes.count ?? 0,
      projects: projectsRes.count ?? 0,
      customers: customersRes.count ?? 0,
      manufacturers: mfrsRes.count ?? 0,
      subcontractors: subsRes.count ?? 0,
      distributors: distRes.count ?? 0,
    })
    setRecentCustomers(recent ?? [])
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
        <DashboardWidget label="Customers" icon={Building2} value={stats.customers} description="Customer accounts" loading={loading} brandColor={brandColor} />
        <DashboardWidget label="Manufacturers" icon={Building2} value={stats.manufacturers} description="Manufacturer relationships" loading={loading} brandColor={brandColor} />
        <DashboardWidget label="Subcontractors" icon={Wrench} value={stats.subcontractors} description="Subcontractor partners" loading={loading} brandColor={brandColor} />
        <DashboardWidget label="Distributors" icon={Building2} value={stats.distributors} description="Distributor accounts" loading={loading} brandColor={brandColor} />
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
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-[13px] font-semibold text-foreground">Recent Customers</h2>
            </div>
            <Link href="/org/customers" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="min-h-[160px]">
            {loading ? (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Loading...</div>
            ) : recentCustomers.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2">
                <Building2 className="h-6 w-6 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No customers yet</p>
                <Link href="/org/customers" className="text-xs text-primary hover:underline">Create your first customer</Link>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentCustomers.map((c) => (
                  <Link key={c.id} href={`/org/customers/${c.id}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/20">
                    <div>
                      <div className="text-sm font-medium text-foreground">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.customer_number}</div>
                    </div>
                    {c.customer_type && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{c.customer_type}</span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
