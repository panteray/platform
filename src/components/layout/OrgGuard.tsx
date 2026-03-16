'use client'

import { useUser } from '@/hooks/useUser'
import { isGlobalRole } from '@/lib/roles'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export function OrgGuard({ children }: { children: React.ReactNode }) {
  const { userRole, orgId, loading } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    // Global-only users go to /admin
    if (userRole && isGlobalRole(userRole)) {
      router.push('/admin')
    }
    // Users without org_id cannot access org routes
    if (!orgId) {
      router.push('/dashboard')
    }
  }, [loading, userRole, orgId, router])

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
