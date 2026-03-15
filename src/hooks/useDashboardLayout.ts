'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from './useUser'

export type ColSpan = 4 | 6 | 12
export type RowSpan = 1 | 2

export interface WidgetConfig {
  id: string
  colSpan: ColSpan
  rowSpan: RowSpan
}

export const WIDGET_REGISTRY: Record<
  string,
  { title: string; description: string; defaultColSpan: ColSpan; defaultRowSpan: RowSpan }
> = {
  notifications: {
    title: 'Notifications',
    description: 'Recent notifications',
    defaultColSpan: 6,
    defaultRowSpan: 2,
  },
  quick_stats: {
    title: 'Quick Stats',
    description: 'Org overview: users, modules, divisions',
    defaultColSpan: 6,
    defaultRowSpan: 1,
  },
  recent_opportunities: {
    title: 'Recent Opportunities',
    description: 'Latest pipeline activity',
    defaultColSpan: 6,
    defaultRowSpan: 1,
  },
  active_projects: {
    title: 'Active Projects',
    description: 'Current project status',
    defaultColSpan: 6,
    defaultRowSpan: 1,
  },
}

const DEFAULT_LAYOUT: WidgetConfig[] = [
  { id: 'notifications', colSpan: 6, rowSpan: 2 },
  { id: 'quick_stats', colSpan: 6, rowSpan: 1 },
  { id: 'recent_opportunities', colSpan: 6, rowSpan: 1 },
  { id: 'active_projects', colSpan: 6, rowSpan: 1 },
]

/** Snap a pixel-based drag delta to the nearest valid colSpan */
export function snapColSpan(currentColSpan: ColSpan, deltaX: number, containerWidth: number): ColSpan {
  const colWidth = containerWidth / 12
  const currentPx = currentColSpan * colWidth
  const targetPx = currentPx + deltaX
  const targetCols = Math.round(targetPx / colWidth)

  if (targetCols <= 5) return 4
  if (targetCols <= 9) return 6
  return 12
}

/** Snap a pixel-based drag delta to the nearest valid rowSpan */
export function snapRowSpan(currentRowSpan: RowSpan, deltaY: number): RowSpan {
  const rowHeight = 160
  const currentPx = currentRowSpan * rowHeight
  const targetPx = currentPx + deltaY
  return targetPx > rowHeight * 1.5 ? 2 : 1
}

/** Human label for colSpan */
export function colSpanLabel(colSpan: ColSpan): string {
  switch (colSpan) {
    case 4: return 'Third'
    case 6: return 'Half'
    case 12: return 'Full'
    default: return 'Half'
  }
}

interface DashboardLayoutState {
  widgets: WidgetConfig[]
  loading: boolean
  saving: boolean
}

export function useDashboardLayout() {
  const { user, authId } = useUser()
  const [state, setState] = useState<DashboardLayoutState>({
    widgets: DEFAULT_LAYOUT,
    loading: true,
    saving: false,
  })

  useEffect(() => {
    if (!user) return
    const prefs = (user.preferences ?? {}) as Record<string, unknown>
    const saved = prefs.dashboard_layout as WidgetConfig[] | undefined
    if (saved && Array.isArray(saved) && saved.length > 0) {
      setState({ widgets: saved, loading: false, saving: false })
    } else {
      setState({ widgets: DEFAULT_LAYOUT, loading: false, saving: false })
    }
  }, [user])

  const saveLayout = useCallback(
    async (widgets: WidgetConfig[]) => {
      if (!authId) return
      setState((s) => ({ ...s, saving: true }))
      const supabase = createClient()
      const currentPrefs = ((user?.preferences ?? {}) as Record<string, unknown>)
      const updated = { ...currentPrefs, dashboard_layout: widgets }
      await supabase
        .from('users')
        .update({ preferences: updated })
        .eq('auth_id', authId)
      setState((s) => ({ ...s, widgets, saving: false }))
    },
    [authId, user?.preferences]
  )

  const addWidget = useCallback(
    (widgetId: string) => {
      const reg = WIDGET_REGISTRY[widgetId]
      if (!reg) return
      const already = state.widgets.find((w) => w.id === widgetId)
      if (already) return
      const next = [...state.widgets, { id: widgetId, colSpan: reg.defaultColSpan, rowSpan: reg.defaultRowSpan }]
      setState((s) => ({ ...s, widgets: next }))
      saveLayout(next)
    },
    [state.widgets, saveLayout]
  )

  const removeWidget = useCallback(
    (widgetId: string) => {
      const next = state.widgets.filter((w) => w.id !== widgetId)
      setState((s) => ({ ...s, widgets: next }))
      saveLayout(next)
    },
    [state.widgets, saveLayout]
  )

  const resizeWidget = useCallback(
    (widgetId: string, colSpan: ColSpan, rowSpan: RowSpan) => {
      const next = state.widgets.map((w) =>
        w.id === widgetId ? { ...w, colSpan, rowSpan } : w
      )
      setState((s) => ({ ...s, widgets: next }))
      saveLayout(next)
    },
    [state.widgets, saveLayout]
  )

  const resetLayout = useCallback(() => {
    setState((s) => ({ ...s, widgets: DEFAULT_LAYOUT }))
    saveLayout(DEFAULT_LAYOUT)
  }, [saveLayout])

  return {
    ...state,
    addWidget,
    removeWidget,
    resizeWidget,
    resetLayout,
    availableWidgets: Object.entries(WIDGET_REGISTRY)
      .filter(([id]) => !state.widgets.find((w) => w.id === id))
      .map(([id, reg]) => ({ id, ...reg })),
  }
}
