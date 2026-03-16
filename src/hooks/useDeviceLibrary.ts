'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import type { DeviceLibraryItem, DeviceSearchResult } from '@/types/database'

interface UseDeviceLibraryOptions {
  initialLimit?: number
}

export function useDeviceLibrary(opts?: UseDeviceLibraryOptions) {
  const limit = opts?.initialLimit ?? 50
  const [results, setResults] = useState<DeviceSearchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterNdaa, setFilterNdaa] = useState<'' | 'true' | 'false'>('')
  const [selectedItem, setSelectedItem] = useState<DeviceLibraryItem | null>(null)
  const [selectedLoading, setSelectedLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchResults = useCallback(async (q: string, category: string, ndaa: string) => {
    setLoading(true)
    setError(null)

    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    if (category) params.set('category', category)
    if (ndaa) params.set('ndaa_compliant', ndaa)
    params.set('limit', String(limit))

    try {
      const res = await fetch(`/api/org/device-library/search?${params}`)
      if (!res.ok) {
        const json = await res.json()
        setError(json.error ?? 'Failed to load devices')
        setResults([])
      } else {
        const json = await res.json()
        setResults(json.results ?? [])
      }
    } catch {
      setError('Network error')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [limit])

  // Debounced search
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      void fetchResults(search, filterCategory, filterNdaa)
    }, 300)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [search, filterCategory, filterNdaa, fetchResults])

  const loadFullItem = useCallback(async (id: string) => {
    setSelectedLoading(true)
    try {
      const res = await fetch(`/api/org/device-library/items/${id}`)
      if (res.ok) {
        const json = await res.json()
        setSelectedItem(json.item)
      }
    } finally {
      setSelectedLoading(false)
    }
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedItem(null)
  }, [])

  return {
    results,
    loading,
    error,
    search,
    setSearch,
    filterCategory,
    setFilterCategory,
    filterNdaa,
    setFilterNdaa,
    selectedItem,
    selectedLoading,
    loadFullItem,
    clearSelection,
    refresh: () => fetchResults(search, filterCategory, filterNdaa),
  }
}
