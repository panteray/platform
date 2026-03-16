'use client'
import { useEffect, useState, useCallback } from 'react'
import type { Manufacturer } from '@/types/database'

export function useManufacturers() {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchManufacturers = useCallback(async () => {
    setLoading(true); setError(null)
    const res = await fetch('/api/org/manufacturers')
    if (!res.ok) { const err = await res.json(); setError(err.error ?? 'Failed to load'); setLoading(false); return }
    setManufacturers(await res.json()); setLoading(false)
  }, [])

  useEffect(() => { fetchManufacturers() }, [fetchManufacturers])

  async function createManufacturer(body: Partial<Manufacturer>): Promise<Manufacturer | null> {
    const res = await fetch('/api/org/manufacturers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) return null
    const created = await res.json(); setManufacturers((prev) => [created, ...prev]); return created
  }

  async function updateManufacturer(body: Partial<Manufacturer> & { id: string }): Promise<Manufacturer | null> {
    const res = await fetch('/api/org/manufacturers', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) return null
    const updated = await res.json(); setManufacturers((prev) => prev.map((m) => (m.id === updated.id ? updated : m))); return updated
  }

  async function deleteManufacturer(id: string): Promise<boolean> {
    const res = await fetch(`/api/org/manufacturers?id=${id}`, { method: 'DELETE' })
    if (!res.ok) return false
    setManufacturers((prev) => prev.filter((m) => m.id !== id)); return true
  }

  return { manufacturers, loading, error, fetchManufacturers, createManufacturer, updateManufacturer, deleteManufacturer }
}
