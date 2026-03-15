'use client'

import { useState } from 'react'
import { X, Maximize2, Minimize2, Plus, RotateCcw } from 'lucide-react'
import { useDashboardLayout, WIDGET_REGISTRY } from '@/hooks/useDashboardLayout'
import type { WidgetConfig } from '@/hooks/useDashboardLayout'
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
      <div className="grid grid-cols-12 gap-4">
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

// ---- Widget Card Wrapper ----

function WidgetCard({
  widget,
  divisionFilter,
  onRemove,
  onResize,
}: {
  widget: WidgetConfig
  divisionFilter: string
  onRemove: () => void
  onResize: (colSpan: 4 | 6 | 8 | 12, rowSpan: 1 | 2) => void
}) {
  const reg = WIDGET_REGISTRY[widget.id]
  const title = reg?.title ?? widget.id

  const isExpanded = widget.colSpan >= 8
  const isTall = widget.rowSpan >= 2

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card overflow-hidden',
        widget.rowSpan === 2 ? 'row-span-2' : 'row-span-1'
      )}
      style={{
        gridColumn: `span ${widget.colSpan} / span ${widget.colSpan}`,
        minHeight: widget.rowSpan === 2 ? '320px' : '160px',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="text-[13px] font-medium text-foreground">{title}</span>
        <div className="flex items-center gap-1">
          {/* Size toggle */}
          <button
            onClick={() => onResize(isExpanded ? 6 : 12, widget.rowSpan)}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={isExpanded ? 'Shrink width' : 'Expand width'}
          >
            {isExpanded ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>
          {/* Height toggle */}
          <button
            onClick={() => onResize(widget.colSpan, isTall ? 1 : 2)}
            className="rounded p-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={isTall ? 'Short' : 'Tall'}
          >
            {isTall ? '1x' : '2x'}
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
