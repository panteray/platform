'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/useUser'
import { isGlobalRole } from '@/lib/roles'

export default function DashboardPage() {
  const router = useRouter()
  const { userRole, orgId, loading } = useUser()

  useEffect(() => {
    if (loading) return

    // Global admins → admin portal
    if (userRole && isGlobalRole(userRole)) {
      router.replace('/admin')
      return
    }

    // Org users → org dashboard
    if (orgId) {
      router.replace('/org')
      return
    }
  }, [loading, userRole, orgId, router])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    )
  }

  // Fallback: no org, not global
  return (
    <div>
      <h1 className="text-lg font-medium">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        No organization assigned. Contact your administrator.
      </p>
    </div>
  )
}
