'use client'

import { useState, useEffect, useCallback } from 'react'
import type { User } from '@/types/database'

export function useOrgUsers(orgId: string | null) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    if (!orgId) { setLoading(false); return }
    try {
      setError(null)
      const res = await fetch(`/api/admin/users?org_id=${orgId}`)
      if (res.ok) {
        const data = await res.json()
        setUsers(data)
      } else {
        setError('Failed to load users')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    }
    setLoading(false)
  }, [orgId])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  return { users, loading, error, refresh: fetchUsers }
}
