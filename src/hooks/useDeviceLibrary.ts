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
  const [filterVendor, setFilterVendor] = useState('')
  const [filterForm, setFilterForm] = useState('')
  const [filterResolution, setFilterResolution] = useState('')
  const [sort, setSort] = useState('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedItem, setSelectedItem] = useState<DeviceLibraryItem | null>(null)
  const [selectedLoading, setSelectedLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchResults = useCallback(async (
    q: string,
    category: string,
    ndaa: string,
    vendor: string,
    form: string,
    resolution: string,
    sortCol: string,
    sortDirection: string,
    pg: number,
  ) => {
    setLoading(true)
    setError(null)

    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    if (category) params.set('category', category)
    if (ndaa) params.set('ndaa_compliant', ndaa)
    if (vendor) params.set('vendor', vendor)
    if (form) params.set('form', form)
    if (resolution) params.set('resolution', resolution)
    if (sortCol) params.set('sort', sortCol)
    if (sortDirection) params.set('sort_dir', sortDirection)
    params.set('limit', String(limit))
    params.set('offset', String(pg * limit))

    try {
      const res = await fetch(`/api/org/device-library/search?${params}`)
      if (!res.ok) {
        const json = await res.json()
        setError(json.error ?? 'Failed to load devices')
        setResults([])
        setTotalCount(0)
      } else {
        const json = await res.json()
        setResults(json.results ?? [])
        setTotalCount(json.total ?? 0)
      }
    } catch {
      setError('Network error')
      setResults([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }, [limit])

  // Reset page when filters change
  useEffect(() => {
    setPage(0)
  }, [search, filterCategory, filterNdaa, filterVendor, filterForm, filterResolution, sort, sortDir])

  // Debounced search
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      void fetchResults(search, filterCategory, filterNdaa, filterVendor, filterForm, filterResolution, sort, sortDir, page)
    }, 300)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [search, filterCategory, filterNdaa, filterVendor, filterForm, filterResolution, sort, sortDir, page, fetchResults])

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
    filterVendor,
    setFilterVendor,
    filterForm,
    setFilterForm,
    filterResolution,
    setFilterResolution,
    sort,
    setSort,
    sortDir,
    setSortDir,
    page,
    setPage,
    totalCount,
    selectedItem,
    selectedLoading,
    loadFullItem,
    clearSelection,
    refresh: () => fetchResults(search, filterCategory, filterNdaa, filterVendor, filterForm, filterResolution, sort, sortDir, page),
  }
}
