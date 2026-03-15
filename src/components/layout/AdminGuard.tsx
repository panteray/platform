'use client'

import { useUser } from '@/hooks/useUser'
import { isGlobalRole } from '@/lib/roles'
import { redirect } from 'next/navigation'
import { useEffect } from 'react'

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { userRole, loading } = useUser()

  useEffect(() => {
    if (!loading && (!userRole || !isGlobalRole(userRole))) {
      redirect('/dashboard')
    }
  }, [loading, userRole])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    )
  }

  if (!userRole || !isGlobalRole(userRole)) return null

  return <>{children}</>
}
