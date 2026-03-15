'use client'

import { useNotifications } from '@/hooks/useNotifications'
import { Bell } from 'lucide-react'

export function NotificationFeed() {
  const { notifications, loading, error } = useNotifications(15)

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        Loading notifications...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        Unable to load notifications
      </div>
    )
  }

  if (notifications.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <Bell className="h-8 w-8 opacity-30" />
        <span className="text-xs">No notifications yet</span>
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {notifications.map((n) => (
        <div
          key={n.id}
          className="flex items-start gap-3 border-b border-border px-3 py-2.5 last:border-b-0"
        >
          <div
            className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${
              n.read ? 'bg-transparent' : 'bg-blue-500'
            }`}
          />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium leading-tight text-foreground">
              {n.title}
            </div>
            {n.message && (
              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                {n.message}
              </div>
            )}
            <div className="mt-1 text-[10px] text-muted-foreground">
              {formatRelativeTime(n.created_at)}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function formatRelativeTime(timestamp: string): string {
  const now = Date.now()
  const then = new Date(timestamp).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return new Date(timestamp).toLocaleDateString()
}
