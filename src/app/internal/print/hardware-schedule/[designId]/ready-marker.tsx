'use client'

import { useEffect } from 'react'

declare global {
  interface Window {
    __printReady?: boolean
  }
}

export function ReadyMarker({ areaIds }: { areaIds: string[] }) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (areaIds.length === 0) {
      window.__printReady = true
      return
    }
    let cancelled = false
    const startedAt = Date.now()
    const poll = () => {
      if (cancelled) return
      const ready = window.__siteMapsReady ?? {}
      const allReady = areaIds.every(id => ready[id])
      const timedOut = Date.now() - startedAt > 30_000
      if (allReady || timedOut) {
        window.__printReady = true
      } else {
        setTimeout(poll, 200)
      }
    }
    poll()
    return () => { cancelled = true }
  }, [areaIds])
  return null
}
