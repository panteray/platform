'use client'

import { useState, useEffect, useCallback } from 'react'
import type { CustomRole } from '@/types/database'

export function useCustomRoles(orgId: string | null) {
  const [roles, setRoles] = useState<CustomRole[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRoles = useCallback(async () => {
    if (!orgId) { setLoading(false); return }
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}`)
      if (res.ok) {
        const data = await res.json()
        setRoles(data.roles ?? [])
      }
    } catch { /* silently fail */ }
    setLoading(false)
  }, [orgId])

  useEffect(() => { fetchRoles() }, [fetchRoles])

  return { roles, loading, refresh: fetchRoles }
}
