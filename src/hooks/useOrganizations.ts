'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Organization } from '@/types/database'

export function useOrganizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrgs = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/admin/organizations')
      if (res.ok) {
        const data = await res.json()
        setOrganizations(data)
      } else {
        setError('Failed to load organizations')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load organizations')
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchOrgs() }, [fetchOrgs])

  return { organizations, loading, error, refresh: fetchOrgs }
}
