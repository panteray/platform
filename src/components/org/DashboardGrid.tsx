'use client'

import { useState, useRef, useCallback } from 'react'
import { X, Plus, RotateCcw, GripVertical } from 'lucide-react'
import { useDashboardLayout, WIDGET_REGISTRY, snapColSpan, snapRowSpan, colSpanLabel } from '@/hooks/useDashboardLayout'
import type { WidgetConfig, ColSpan, RowSpan } from '@/hooks/useDashboardLayout'
import { NotificationFeed } from './NotificationFeed'
import { QuickStatsWidget } from './QuickStatsWidget'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface DashboardGridProps {
  divisionFilter: string
}

export function DashboardGrid({ divisionFilter }: DashboardGridProps) {
  const {
    widgets,
    loading,
    saving,
    addWidget,
    removeWidget,
    resizeWidget,
    resetLayout,
    availableWidgets,
  } = useDashboardLayout()
  const [showPicker, setShowPicker] = useState(false)

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading dashboard...</div>
  }

  return (
    <div>
      {/* Controls */}
      <div className="mb-4 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => setShowPicker(!showPicker)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Widget
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={resetLayout}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
        {saving && (
          <span className="text-[10px] text-muted-foreground">Saving...</span>
        )}
      </div>

      {/* Widget Picker */}
      {showPicker && availableWidgets.length > 0 && (
        <div className="mb-4 rounded-lg border border-dashed border-border bg-muted/30 p-3">
          <div className="mb-2 text-xs font-medium text-muted-foreground">
            Available Widgets
          </div>
          <div className="flex flex-wrap gap-2">
            {availableWidgets.map((w) => (
              <button
                key={w.id}
                onClick={() => {
                  addWidget(w.id)
                  setShowPicker(false)
                }}
                className="rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
              >
                {w.title}
              </button>
            ))}
          </div>
        </div>
      )}
      {showPicker && availableWidgets.length === 0 && (
        <div className="mb-4 rounded-lg border border-dashed border-border bg-muted/30 p-3">
          <div className="text-xs text-muted-foreground">All widgets are on the dashboard</div>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-12 gap-4" id="dashboard-grid">
        {widgets.map((widget) => (
          <WidgetCard
            key={widget.id}
            widget={widget}
            divisionFilter={divisionFilter}
            onRemove={() => removeWidget(widget.id)}
            onResize={(colSpan, rowSpan) => resizeWidget(widget.id, colSpan, rowSpan)}
          />
        ))}
      </div>

      {widgets.length === 0 && (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border">
          <span className="text-sm text-muted-foreground">
            No widgets. Click &quot;Add Widget&quot; to get started.
          </span>
        </div>
      )}
    </div>
  )
}

// ---- Widget Card with Drag-to-Resize ----

function WidgetCard({
  widget,
  divisionFilter,
  onRemove,
  onResize,
}: {
  widget: WidgetConfig
  divisionFilter: string
  onRemove: () => void
  onResize: (colSpan: ColSpan, rowSpan: RowSpan) => void
}) {
  const reg = WIDGET_REGISTRY[widget.id]
  const title = reg?.title ?? widget.id
  const cardRef = useRef<HTMLDivElement>(null)
  const [draggingEdge, setDraggingEdge] = useState<'right' | 'bottom' | null>(null)
  const [previewColSpan, setPreviewColSpan] = useState<ColSpan | null>(null)
  const [previewRowSpan, setPreviewRowSpan] = useState<RowSpan | null>(null)

  const activeColSpan = previewColSpan ?? widget.colSpan
  const activeRowSpan = previewRowSpan ?? widget.rowSpan

  // Size selector buttons
  const sizeOptions: ColSpan[] = [4, 6, 12]

  const handleMouseDownRight = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const grid = document.getElementById('dashboard-grid')
    const containerWidth = grid?.clientWidth ?? 800

    setDraggingEdge('right')

    function onMove(ev: MouseEvent) {
      const deltaX = ev.clientX - startX
      const snapped = snapColSpan(widget.colSpan, deltaX, containerWidth)
      setPreviewColSpan(snapped)
    }

    function onUp(ev: MouseEvent) {
      const deltaX = ev.clientX - startX
      const snapped = snapColSpan(widget.colSpan, deltaX, containerWidth)
      setDraggingEdge(null)
      setPreviewColSpan(null)
      if (snapped !== widget.colSpan) {
        onResize(snapped, widget.rowSpan)
      }
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [widget.colSpan, widget.rowSpan, onResize])

  const handleMouseDownBottom = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY

    setDraggingEdge('bottom')

    function onMove(ev: MouseEvent) {
      const deltaY = ev.clientY - startY
      const snapped = snapRowSpan(widget.rowSpan, deltaY)
      setPreviewRowSpan(snapped)
    }

    function onUp(ev: MouseEvent) {
      const deltaY = ev.clientY - startY
      const snapped = snapRowSpan(widget.rowSpan, deltaY)
      setDraggingEdge(null)
      setPreviewRowSpan(null)
      if (snapped !== widget.rowSpan) {
        onResize(widget.colSpan, snapped)
      }
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [widget.colSpan, widget.rowSpan, onResize])

  return (
    <div
      ref={cardRef}
      className={cn(
        'group relative overflow-hidden rounded-lg border bg-card',
        draggingEdge ? 'border-blue-500/50' : 'border-border',
        activeRowSpan === 2 ? 'row-span-2' : 'row-span-1'
      )}
      style={{
        gridColumn: `span ${activeColSpan} / span ${activeColSpan}`,
        minHeight: activeRowSpan === 2 ? '320px' : '160px',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="text-[13px] font-medium text-foreground">{title}</span>
        <div className="flex items-center gap-1">
          {/* Size selector: Third / Half / Full */}
          <div className="mr-1 flex items-center rounded-md border border-border">
            {sizeOptions.map((size) => (
              <button
                key={size}
                onClick={() => onResize(size, widget.rowSpan)}
                className={cn(
                  'px-2 py-0.5 text-[10px] font-medium transition-colors',
                  widget.colSpan === size
                    ? 'bg-foreground/10 text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {colSpanLabel(size)}
              </button>
            ))}
          </div>
          {/* Height toggle */}
          <button
            onClick={() => onResize(widget.colSpan, widget.rowSpan === 2 ? 1 : 2)}
            className="rounded p-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={widget.rowSpan === 2 ? 'Short' : 'Tall'}
          >
            {widget.rowSpan === 2 ? '1x' : '2x'}
          </button>
          {/* Remove */}
          <button
            onClick={onRemove}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            title="Remove widget"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="h-full overflow-y-auto">
        <WidgetContent widgetId={widget.id} divisionFilter={divisionFilter} />
      </div>

      {/* Right edge drag handle */}
      <div
        onMouseDown={handleMouseDownRight}
        className="absolute right-0 top-0 z-10 flex h-full w-2 cursor-col-resize items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
      >
        <div className="h-8 w-1 rounded-full bg-muted-foreground/30" />
      </div>

      {/* Bottom edge drag handle */}
      <div
        onMouseDown={handleMouseDownBottom}
        className="absolute bottom-0 left-0 z-10 flex h-2 w-full cursor-row-resize items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
      >
        <div className="h-1 w-8 rounded-full bg-muted-foreground/30" />
      </div>

      {/* Drag preview indicator */}
      {draggingEdge && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-blue-500/5">
          <span className="rounded-md bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-500">
            {colSpanLabel(activeColSpan)} / {activeRowSpan}x
          </span>
        </div>
      )}
    </div>
  )
}

// ---- Widget Content Router ----

function WidgetContent({
  widgetId,
  divisionFilter,
}: {
  widgetId: string
  divisionFilter: string
}) {
  switch (widgetId) {
    case 'notifications':
      return <NotificationFeed />
    case 'quick_stats':
      return <QuickStatsWidget />
    case 'recent_opportunities':
      return <PlaceholderWidget phase={5} label="Recent Opportunities" />
    case 'active_projects':
      return <PlaceholderWidget phase={5} label="Active Projects" />
    default:
      return <PlaceholderWidget phase={0} label={widgetId} />
  }
}

function PlaceholderWidget({ phase, label }: { phase: number; label: string }) {
  return (
    <div className="flex h-full min-h-[100px] flex-col items-center justify-center gap-1 p-4 text-muted-foreground">
      <span className="text-sm font-medium">{label}</span>
      {phase > 0 && (
        <span className="text-[11px]">Coming in Phase {phase}</span>
      )}
    </div>
  )
}
