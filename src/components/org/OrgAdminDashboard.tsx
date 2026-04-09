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
  const [stats, setStats] = useState<Record<string, number | null>>({ users: 0, opps: 0, projects: 0, customers: 0, manufacturers: 0, subcontractors: 0, distributors: 0 })
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
      users: usersRes.error ? null : (usersRes.count ?? 0),
      opps: oppsRes.error ? null : (oppsRes.count ?? 0),
      projects: projectsRes.error ? null : (projectsRes.count ?? 0),
      customers: customersRes.error ? null : (customersRes.count ?? 0),
      manufacturers: mfrsRes.error ? null : (mfrsRes.count ?? 0),
      subcontractors: subsRes.error ? null : (subsRes.count ?? 0),
      distributors: distRes.error ? null : (distRes.count ?? 0),
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
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Organization Dashboard</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Overview of your organization metrics</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <DashboardWidget label="Active Users" icon={Users} value={stats.users} description="Team members in your org" loading={loading} brandColor={brandColor} accentIndex={0} />
        <DashboardWidget label="Opportunities" icon={Briefcase} value={stats.opps} description="Total pipeline opportunities" loading={loading} brandColor={brandColor} accentIndex={1} />
        <DashboardWidget label="Projects" icon={FolderKanban} value={stats.projects} description="Active project engagements" loading={loading} brandColor={brandColor} accentIndex={2} />
        <DashboardWidget label="Customers" icon={Building2} value={stats.customers} description="Customer accounts" loading={loading} brandColor={brandColor} accentIndex={3} />
        <DashboardWidget label="Manufacturers" icon={Building2} value={stats.manufacturers} description="Manufacturer relationships" loading={loading} brandColor={brandColor} accentIndex={4} />
        <DashboardWidget label="Subcontractors" icon={Wrench} value={stats.subcontractors} description="Subcontractor partners" loading={loading} brandColor={brandColor} accentIndex={5} />
        <DashboardWidget label="Distributors" icon={Building2} value={stats.distributors} description="Distributor accounts" loading={loading} brandColor={brandColor} accentIndex={6} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-border/40 bg-card shadow-pt-sm">
          <div className="flex items-center gap-2.5 border-b border-border/30 px-4 py-3">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-[13px] font-semibold text-foreground">Recent Notifications</h2>
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            <NotificationFeed />
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-border/40 bg-card shadow-pt-sm">
          <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-[13px] font-semibold text-foreground">Recent Customers</h2>
            </div>
            <Link href="/org/customers" className="text-xs text-pt-purple-light hover:underline">View all</Link>
          </div>
          <div className="min-h-[160px]">
            {loading ? (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Loading...</div>
            ) : recentCustomers.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2">
                <Building2 className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No customers yet</p>
                <Link href="/org/customers" className="text-xs text-pt-purple-light hover:underline">Create your first customer</Link>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {recentCustomers.map((c) => (
                  <Link key={c.id} href={`/org/customers/${c.id}`} className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-accent/40">
                    <div>
                      <div className="text-sm font-medium text-foreground">{c.name}</div>
                      <div className="text-[11px] text-muted-foreground">{c.customer_number}</div>
                    </div>
                    {c.customer_type && (
                      <span className="rounded-md bg-pt-purple/10 px-2 py-0.5 text-[10px] font-medium text-pt-purple-light">{c.customer_type}</span>
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
