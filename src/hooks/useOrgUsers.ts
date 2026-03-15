'use client'

import { useState, useEffect, useCallback } from 'react'
import type { User } from '@/types/database'

export function useOrgUsers(orgId: string | null) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  const fetchUsers = useCallback(async () => {
    if (!orgId) { setLoading(false); return }
    try {
      const res = await fetch(`/api/admin/users?org_id=${orgId}`)
      if (res.ok) {
        const data = await res.json()
        setUsers(data)
      }
    } catch {
      // silently fail
    }
    setLoading(false)
  }, [orgId])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  return { users, loading, refresh: fetchUsers }
}
