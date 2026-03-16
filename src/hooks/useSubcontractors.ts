'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Subcontractor } from '@/types/database'

export function useSubcontractors() {
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSubcontractors = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await fetch('/api/org/subcontractors')
    if (!res.ok) {
      const err = await res.json()
      setError(err.error ?? 'Failed to load subcontractors')
      setLoading(false)
      return
    }
    const data = await res.json()
    setSubcontractors(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchSubcontractors() }, [fetchSubcontractors])

  async function createSubcontractor(body: Partial<Subcontractor>): Promise<Subcontractor | null> {
    const res = await fetch('/api/org/subcontractors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) return null
    const created = await res.json()
    setSubcontractors((prev) => [created, ...prev])
    return created
  }

  async function updateSubcontractor(body: Partial<Subcontractor> & { id: string }): Promise<Subcontractor | null> {
    const res = await fetch('/api/org/subcontractors', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) return null
    const updated = await res.json()
    setSubcontractors((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
    return updated
  }

  async function deleteSubcontractor(id: string): Promise<boolean> {
    const res = await fetch(`/api/org/subcontractors?id=${id}`, { method: 'DELETE' })
    if (!res.ok) return false
    setSubcontractors((prev) => prev.filter((s) => s.id !== id))
    return true
  }

  return { subcontractors, loading, error, fetchSubcontractors, createSubcontractor, updateSubcontractor, deleteSubcontractor }
}
