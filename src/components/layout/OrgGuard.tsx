'use client'

import { useUser } from '@/hooks/useUser'
import { isGlobalRole } from '@/lib/roles'
import { redirect } from 'next/navigation'
import { useEffect } from 'react'

export function OrgGuard({ children }: { children: React.ReactNode }) {
  const { userRole, orgId, loading } = useUser()

  useEffect(() => {
    if (loading) return
    // Global-only users go to /admin
    if (userRole && isGlobalRole(userRole)) {
      redirect('/admin')
    }
    // Users without org_id cannot access org routes
    if (!orgId) {
      redirect('/dashboard')
    }
  }, [loading, userRole, orgId])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!orgId) return null

  return <>{children}</>
}
