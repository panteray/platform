'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { UserDetailPage } from '@/components/admin/UserDetailPage'
import type { User as DbUser } from '@/types/database'

export default function AdminUserDetailPage() {
  const params = useParams()
  const orgId = params.id as string
  const userId = params.userId as string
  const [user, setUser] = useState<DbUser | null>(null)

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/admin/users?org_id=${orgId}`)
      if (res.ok) {
        const users = await res.json()
        const found = users.find((u: DbUser) => u.id === userId)
        if (found) setUser(found)
      }
    }
    load()
  }, [orgId, userId])

  if (!user) return <div className="text-sm text-muted-foreground">Loading...</div>

  return (
    <UserDetailPage
      user={user}
      backHref={`/admin/organizations/${orgId}`}
      backLabel="Organization"
      apiBase="/api/admin/users"
      apiPasswordBase="/api/admin/users"
      onSaved={() => {
        fetch(`/api/admin/users?org_id=${orgId}`).then(r => r.json()).then(users => {
          const found = users.find((u: DbUser) => u.id === userId)
          if (found) setUser(found)
        })
      }}
    />
  )
}
