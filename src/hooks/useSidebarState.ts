'use client'

import { useSyncExternalStore, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'

const STORAGE_KEY = 'panteray-sidebar-collapsed'

type State = { collapsed: boolean; mobileOpen: boolean; mounted: boolean }
const listeners = new Set<() => void>()
let state: State = { collapsed: false, mobileOpen: false, mounted: false }

function setState(partial: Partial<State>) {
  state = { ...state, ...partial }
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

function getSnapshot() { return state }
const serverSnapshot: State = { collapsed: false, mobileOpen: false, mounted: false }
function getServerSnapshot(): State { return serverSnapshot }

let initialized = false
function initOnce() {
  if (initialized) return
  initialized = true
  try {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    setState({ collapsed: stored === 'true', mounted: true })
  } catch {
    setState({ mounted: true })
  }
}

export function useSidebarState() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const pathname = usePathname()

  useEffect(() => { initOnce() }, [])
  useEffect(() => { setState({ mobileOpen: false }) }, [pathname])

  const toggle = useCallback(() => {
    const next = !state.collapsed
    try { localStorage.setItem(STORAGE_KEY, String(next)) } catch { /* ignore */ }
    setState({ collapsed: next })
  }, [])

  const toggleMobile = useCallback(() => setState({ mobileOpen: !state.mobileOpen }), [])
  const closeMobile = useCallback(() => setState({ mobileOpen: false }), [])

  return {
    collapsed: snap.collapsed,
    mobileOpen: snap.mobileOpen,
    mounted: snap.mounted,
    toggle,
    toggleMobile,
    closeMobile,
  }
}
