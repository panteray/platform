'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import GridLayout, { WidthProvider, type Layout, type LayoutItem as RGLItem } from 'react-grid-layout/legacy'
import { Pencil, Check, X, Plus, RotateCcw } from 'lucide-react'
import { WIDGETS, WIDGET_IDS } from './widget-registry'
import { layoutForRole, type LayoutItem } from './default-layouts'
import { UserRole } from '@/types/enums'

const ReactGridLayout = WidthProvider(GridLayout)

interface Props {
  role: UserRole | null
  brandColor: string | null
  divisionFilter: string
}

function toRGL(items: LayoutItem[]): RGLItem[] {
  return items
    .filter(it => WIDGETS[it.i])
    .map(it => ({ i: it.i, x: it.x, y: it.y, w: it.w, h: it.h, minW: it.minW ?? 2, minH: it.minH ?? 2 }))
}

function fromRGL(items: Layout): LayoutItem[] {
  return items.map(it => ({ i: it.i, x: it.x, y: it.y, w: it.w, h: it.h, minW: it.minW, minH: it.minH }))
}

export function EditableDashboard({ role, brandColor, divisionFilter }: Props) {
  const defaults = useMemo(() => layoutForRole(role), [role])
  const [layout, setLayout] = useState<LayoutItem[]>(defaults)
  const [loaded, setLoaded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const addRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/org/dashboard/layout')
      .then(r => r.ok ? r.json() : { layout: null })
      .then(({ layout: saved }) => {
        if (cancelled) return
        if (Array.isArray(saved) && saved.length > 0) setLayout(saved as LayoutItem[])
        else setLayout(defaults)
        setLoaded(true)
      })
      .catch(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [defaults])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!addRef.current) return
      if (!addRef.current.contains(e.target as Node)) setShowAdd(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const onLayoutChange = useCallback((next: Layout) => {
    setLayout(fromRGL(next))
  }, [])

  const removeWidget = useCallback((id: string) => {
    setLayout(prev => prev.filter(it => it.i !== id))
  }, [])

  const addWidget = useCallback((id: string) => {
    const def = WIDGETS[id]
    if (!def) return
    setLayout(prev => {
      if (prev.some(it => it.i === id)) return prev
      const maxY = prev.reduce((m, it) => Math.max(m, it.y + it.h), 0)
      return [...prev, { i: id, x: 0, y: maxY, w: def.defaultSize.w, h: def.defaultSize.h, minW: def.defaultSize.minW, minH: def.defaultSize.minH }]
    })
    setShowAdd(false)
  }, [])

  const save = useCallback(async () => {
    setSaving(true)
    try {
      await fetch('/api/org/dashboard/layout', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout }),
      })
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }, [layout])

  const resetDefault = useCallback(async () => {
    setLayout(defaults)
    await fetch('/api/org/dashboard/layout', { method: 'DELETE' })
  }, [defaults])

  const cancel = useCallback(() => {
    // reload from server
    fetch('/api/org/dashboard/layout')
      .then(r => r.ok ? r.json() : { layout: null })
      .then(({ layout: saved }) => setLayout(Array.isArray(saved) && saved.length > 0 ? saved : defaults))
    setEditing(false)
  }, [defaults])

  const available = WIDGET_IDS.filter(id => !layout.some(it => it.i === id))
  const rglLayout = toRGL(layout)

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-end gap-2">
        {editing ? (
          <>
            <div className="relative" ref={addRef}>
              <button
                type="button"
                onClick={() => setShowAdd(v => !v)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
              >
                <Plus className="h-3.5 w-3.5" /> Add Widget
              </button>
              {showAdd && (
                <div className="absolute right-0 z-20 mt-1 max-h-80 w-64 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-lg">
                  {available.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-muted-foreground">All widgets already on your dashboard</div>
                  ) : (
                    available.map(id => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => addWidget(id)}
                        className="flex w-full items-center justify-between rounded px-3 py-1.5 text-left text-xs text-foreground hover:bg-accent/40"
                      >
                        <span>{WIDGETS[id].label}</span>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">+</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={resetDefault}
              title="Reset to default layout"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent/40"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
            <button
              type="button"
              onClick={cancel}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent/40"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-pt-purple px-3 py-1.5 text-xs font-medium text-white hover:bg-pt-purple-light disabled:opacity-60"
            >
              <Check className="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit Dashboard
          </button>
        )}
      </div>

      {!loaded ? (
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Loading dashboard…</div>
      ) : (
        <ReactGridLayout
          className="layout"
          layout={rglLayout}
          cols={12}
          rowHeight={60}
          margin={[12, 12]}
          containerPadding={[0, 0]}
          isDraggable={editing}
          isResizable={editing}
          compactType="vertical"
          onLayoutChange={onLayoutChange}
          draggableCancel=".widget-remove-btn"
        >
          {rglLayout.map(it => {
            const def = WIDGETS[it.i]
            if (!def) return null
            const Render = def.render
            return (
              <div key={it.i} className={`relative ${editing ? 'ring-2 ring-dashed ring-pt-purple/50 rounded-lg' : ''}`}>
                {editing && (
                  <button
                    type="button"
                    onClick={() => removeWidget(it.i)}
                    className="widget-remove-btn absolute -right-2 -top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow hover:bg-red-50 hover:text-red-600"
                    title="Remove widget"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                <div className="h-full w-full">
                  <Render brandColor={brandColor} divisionFilter={divisionFilter} />
                </div>
              </div>
            )
          })}
        </ReactGridLayout>
      )}
    </div>
  )
}
