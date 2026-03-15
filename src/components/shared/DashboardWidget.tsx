'use client'

import type { LucideIcon } from 'lucide-react'

interface DashboardWidgetProps {
  label: string
  icon: LucideIcon
  value?: number | null
  description?: string
  emptyMessage?: string
  loading?: boolean
  brandColor?: string | null
}

export function DashboardWidget({
  label,
  icon: Icon,
  value,
  description,
  emptyMessage,
  loading = false,
  brandColor = null,
}: DashboardWidgetProps) {
  const isEmptyState = value === undefined && emptyMessage

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div
        className={brandColor ? 'h-1' : 'h-1 bg-muted'}
        style={brandColor ? { backgroundColor: brandColor } : undefined}
      />
      <div className="p-5">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${brandColor ? '' : 'bg-muted'}`}
            style={brandColor ? { backgroundColor: `${brandColor}18` } : undefined}
          >
            <span
              className={brandColor ? '' : 'text-muted-foreground'}
              style={brandColor ? { color: brandColor } : undefined}
            >
              <Icon className="h-5 w-5" />
            </span>
          </div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
        </div>
        <div className="mt-4">
          {loading ? (
            <div className="h-9 w-16 animate-pulse rounded bg-muted" />
          ) : isEmptyState ? (
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground/60">{emptyMessage}</p>
            </div>
          ) : (
            <p className="text-3xl font-semibold tabular-nums text-foreground">
              {value ?? 0}
            </p>
          )}
          {description && (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
    </div>
  )
}
