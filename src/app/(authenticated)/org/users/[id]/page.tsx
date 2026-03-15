'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { UserDetailPage } from '@/components/admin/UserDetailPage'
import type { User as DbUser } from '@/types/database'

export default function OrgUserDetailPage() {
  const params = useParams()
  const userId = params.id as string
  const [user, setUser] = useState<DbUser | null>(null)

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/org/users')
      if (res.ok) {
        const users = await res.json()
        const found = users.find((u: DbUser) => u.id === userId)
        if (found) setUser(found)
      }
    }
    load()
  }, [userId])

  if (!user) return <div className="text-sm text-muted-foreground">Loading...</div>

  return (
    <UserDetailPage
      user={user}
      backHref="/org/users"
      backLabel="Users"
      apiBase="/api/org/users"
      apiPasswordBase="/api/org/users"
      onSaved={() => {
        // Reload user data
        fetch('/api/org/users').then(r => r.json()).then(users => {
          const found = users.find((u: DbUser) => u.id === userId)
          if (found) setUser(found)
        })
      }}
    />
  )
}
