'use client'

import { useState, useEffect } from 'react'

let cachedKey: string | null = null

/**
 * Fetches the Google Maps API key from the backend.
 * Caches across renders and component instances.
 */
export function useMapsApiKey(): string | null {
  const [key, setKey] = useState<string | null>(cachedKey)

  useEffect(() => {
    if (cachedKey) { setKey(cachedKey); return }
    let cancelled = false
    fetch('/api/org/maps-key')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled || !data?.key) return
        cachedKey = data.key
        setKey(data.key)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  return key
}
