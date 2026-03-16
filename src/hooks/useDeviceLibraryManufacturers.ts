'use client'

import { useEffect, useState, useCallback } from 'react'
import type { DeviceLibraryManufacturer } from '@/types/database'

export function useDeviceLibraryManufacturers() {
  const [manufacturers, setManufacturers] = useState<DeviceLibraryManufacturer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchManufacturers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/org/device-library/manufacturers')
      if (!res.ok) {
        const json = await res.json()
        setError(json.error ?? 'Failed to load manufacturers')
        return
      }
      const json = await res.json()
      setManufacturers(json.manufacturers ?? [])
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchManufacturers()
  }, [fetchManufacturers])

  const createManufacturer = useCallback(async (data: {
    name: string
    ndaa_status?: string
    ndaa_notes?: string
    website?: string
  }): Promise<DeviceLibraryManufacturer | null> => {
    try {
      const res = await fetch('/api/org/device-library/manufacturers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const json = await res.json()
        setError(json.error ?? 'Failed to create manufacturer')
        return null
      }
      const json = await res.json()
      await fetchManufacturers()
      return json.manufacturer
    } catch {
      setError('Network error')
      return null
    }
  }, [fetchManufacturers])

  const updateManufacturer = useCallback(async (
    id: string,
    data: Record<string, unknown>,
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/org/device-library/manufacturers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const json = await res.json()
        setError(json.error ?? 'Failed to update manufacturer')
        return false
      }
      await fetchManufacturers()
      return true
    } catch {
      setError('Network error')
      return false
    }
  }, [fetchManufacturers])

  return {
    manufacturers,
    loading,
    error,
    refresh: fetchManufacturers,
    createManufacturer,
    updateManufacturer,
  }
}
