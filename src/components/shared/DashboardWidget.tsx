'use client'

import type { LucideIcon } from 'lucide-react'

/* Brand accent colors for stat card top lines */
const ACCENT_COLORS = ['#522F82', '#F97316', '#16A34A', '#14B8A6', '#3B82F6', '#F59E0B', '#EF4444', '#6B46A6']

interface DashboardWidgetProps {
  label: string
  icon: LucideIcon
  value?: number | null
  description?: string
  emptyMessage?: string
  loading?: boolean
  brandColor?: string | null
  accentIndex?: number
}

export function DashboardWidget({
  label,
  icon: Icon,
  value,
  description,
  emptyMessage,
  loading = false,
  brandColor = null,
  accentIndex = 0,
}: DashboardWidgetProps) {
  const isEmptyState = value === undefined && emptyMessage
  const accent = brandColor || ACCENT_COLORS[accentIndex % ACCENT_COLORS.length]

  return (
    <div className="group overflow-hidden rounded-xl border border-border/40 bg-card shadow-pt-sm transition-all duration-150 hover:shadow-pt-md">
      {/* Colored accent line */}
      <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}80)` }} />
      <div className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <Icon className="h-4 w-4 text-muted-foreground/60" />
        </div>
        <div className="mt-3">
          {loading ? (
            <div className="h-8 w-14 animate-pulse rounded-md bg-muted/60" />
          ) : isEmptyState ? (
            <p className="text-[13px] text-muted-foreground">{emptyMessage}</p>
          ) : (
            <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">
              {value === null ? '—' : (value ?? 0)}
            </p>
          )}
          {description && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
    </div>
  )
}
