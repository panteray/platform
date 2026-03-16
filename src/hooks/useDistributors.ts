'use client'
import { useEffect, useState, useCallback } from 'react'
import type { Distributor } from '@/types/database'

export function useDistributors() {
  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDistributors = useCallback(async () => {
    setLoading(true); setError(null)
    const res = await fetch('/api/org/distributors')
    if (!res.ok) { const err = await res.json(); setError(err.error ?? 'Failed'); setLoading(false); return }
    setDistributors(await res.json()); setLoading(false)
  }, [])

  useEffect(() => { fetchDistributors() }, [fetchDistributors])

  async function createDistributor(body: Partial<Distributor>): Promise<Distributor | null> {
    const res = await fetch('/api/org/distributors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) return null; const created = await res.json(); setDistributors((prev) => [created, ...prev]); return created
  }
  async function updateDistributor(body: Partial<Distributor> & { id: string }): Promise<Distributor | null> {
    const res = await fetch('/api/org/distributors', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) return null; const updated = await res.json(); setDistributors((prev) => prev.map((d) => (d.id === updated.id ? updated : d))); return updated
  }
  async function deleteDistributor(id: string): Promise<boolean> {
    const res = await fetch(`/api/org/distributors?id=${id}`, { method: 'DELETE' })
    if (!res.ok) return false; setDistributors((prev) => prev.filter((d) => d.id !== id)); return true
  }

  return { distributors, loading, error, fetchDistributors, createDistributor, updateDistributor, deleteDistributor }
}
