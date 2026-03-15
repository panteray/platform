'use client'

import { useRouter } from 'next/navigation'
import { Building2, ChevronRight } from 'lucide-react'
import { useOrganizations } from '@/hooks/useOrganizations'
import { SummaryCards } from '@/components/admin/SummaryCards'
import { Badge } from '@/components/ui/badge'

export default function AdminDashboard() {
  const router = useRouter()
  const { organizations, loading } = useOrganizations()

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>
  }

  function statusVariant(status: string) {
    if (status === 'active') return 'success' as const
    if (status === 'suspended') return 'warning' as const
    return 'destructive' as const
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>Home</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Dashboard</span>
      </div>

      <h1 className="mb-5 text-lg font-medium">Dashboard</h1>

      <SummaryCards organizations={organizations} />

      {/* Recent orgs */}
      <div className="mt-6 rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-3.5 text-sm font-medium">
          Recent organizations
        </div>
        {organizations.slice(0, 5).map((org) => (
          <div
            key={org.id}
            className="flex cursor-pointer items-center justify-between border-b border-border px-5 py-3 transition-colors hover:bg-muted/30 last:border-b-0"
            onClick={() => router.push(`/admin/organizations/${org.id}`)}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-muted text-[10px] font-semibold text-muted-foreground">
                {org.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <span className="text-[13px] font-medium">{org.name}</span>
              <Badge variant={statusVariant(org.status)} className="text-[10px] capitalize">
                {org.status}
              </Badge>
            </div>
          </div>
        ))}
        {organizations.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            No organizations yet
          </div>
        )}
      </div>
    </div>
  )
}
