'use client'

import { useState, useEffect, useCallback } from 'react'
import type { CustomRole } from '@/types/database'

export function useCustomRoles(orgId: string | null) {
  const [roles, setRoles] = useState<CustomRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRoles = useCallback(async () => {
    if (!orgId) { setLoading(false); return }
    try {
      setError(null)
      const res = await fetch(`/api/admin/organizations/${orgId}`)
      if (res.ok) {
        const data = await res.json()
        setRoles(data.roles ?? [])
      } else {
        setError('Failed to load roles')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roles')
    }
    setLoading(false)
  }, [orgId])

  useEffect(() => { fetchRoles() }, [fetchRoles])

  return { roles, loading, error, refresh: fetchRoles }
}
