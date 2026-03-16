'use client'
import { useEffect, useState, useCallback } from 'react'
import type { Opportunity } from '@/types/database'

export function useOpportunities() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)

  const fetchOpportunities = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/org/opportunities')
    if (!res.ok) { setLoading(false); return }
    setOpportunities(await res.json()); setLoading(false)
  }, [])

  useEffect(() => { fetchOpportunities() }, [fetchOpportunities])

  async function deleteOpportunity(id: string): Promise<boolean> {
    const res = await fetch(`/api/org/opportunities?id=${id}`, { method: 'DELETE' })
    if (!res.ok) return false
    setOpportunities((prev) => prev.filter((o) => o.id !== id)); return true
  }

  return { opportunities, loading, fetchOpportunities, deleteOpportunity }
}
