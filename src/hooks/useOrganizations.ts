'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Organization } from '@/types/database'

export function useOrganizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)

  const fetchOrgs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/organizations')
      if (res.ok) {
        const data = await res.json()
        setOrganizations(data)
      }
    } catch {
      // silently fail
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchOrgs() }, [fetchOrgs])

  return { organizations, loading, refresh: fetchOrgs }
}
