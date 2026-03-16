'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Vendor } from '@/types/database'

export function useVendors() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchVendors = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await fetch('/api/org/vendors')
    if (!res.ok) {
      const err = await res.json()
      setError(err.error ?? 'Failed to load vendors')
      setLoading(false)
      return
    }
    const data = await res.json()
    setVendors(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchVendors() }, [fetchVendors])

  async function createVendor(body: Partial<Vendor>): Promise<Vendor | null> {
    const res = await fetch('/api/org/vendors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) return null
    const created = await res.json()
    setVendors((prev) => [created, ...prev])
    return created
  }

  async function updateVendor(body: Partial<Vendor> & { id: string }): Promise<Vendor | null> {
    const res = await fetch('/api/org/vendors', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) return null
    const updated = await res.json()
    setVendors((prev) => prev.map((v) => (v.id === updated.id ? updated : v)))
    return updated
  }

  async function deleteVendor(id: string): Promise<boolean> {
    const res = await fetch(`/api/org/vendors?id=${id}`, { method: 'DELETE' })
    if (!res.ok) return false
    setVendors((prev) => prev.filter((v) => v.id !== id))
    return true
  }

  return { vendors, loading, error, fetchVendors, createVendor, updateVendor, deleteVendor }
}
