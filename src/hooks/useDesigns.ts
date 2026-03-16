'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Design } from '@/types/database'

interface DesignWithOpp extends Design {
  opportunities: {
    id: string
    opp_number: string
    project_name: string | null
    customer_name: string | null
  } | null
}

export function useDesigns() {
  const [designs, setDesigns] = useState<DesignWithOpp[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDesigns = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/org/designs')
      if (!res.ok) {
        const json = await res.json()
        setError(json.error ?? 'Failed to load designs')
        return
      }
      const json = await res.json()
      setDesigns(json.designs ?? [])
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchDesigns()
  }, [fetchDesigns])

  const createDesign = useCallback(async (oppId: string, name?: string): Promise<Design | null> => {
    try {
      const res = await fetch('/api/org/designs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opp_id: oppId, name }),
      })
      if (!res.ok) {
        const json = await res.json()
        setError(json.error ?? 'Failed to create design')
        return null
      }
      const json = await res.json()
      await fetchDesigns()
      return json.design
    } catch {
      setError('Network error')
      return null
    }
  }, [fetchDesigns])

  const archiveDesign = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/org/designs/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json()
        setError(json.error ?? 'Failed to archive design')
        return false
      }
      await fetchDesigns()
      return true
    } catch {
      setError('Network error')
      return false
    }
  }, [fetchDesigns])

  return {
    designs,
    loading,
    error,
    refresh: fetchDesigns,
    createDesign,
    archiveDesign,
  }
}
