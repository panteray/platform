'use client'

import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'panteray-sidebar-collapsed'

export function useSidebarState() {
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'true') setCollapsed(true)
    } catch {
      // ignore
    }
    setMounted(true)
  }, [])

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem(STORAGE_KEY, String(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  return { collapsed, toggle, mounted }
}
