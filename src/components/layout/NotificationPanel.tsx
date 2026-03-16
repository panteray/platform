'use client'

import { useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck } from 'lucide-react'
import { useNotifications } from '@/hooks/useNotifications'
import { Button } from '@/components/ui/button'

interface NotificationPanelProps {
  open: boolean
  onClose: () => void
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

export function NotificationPanel({ open, onClose }: NotificationPanelProps) {
  const router = useRouter()
  const panelRef = useRef<HTMLDivElement>(null)
  const { notifications, loading, markRead, markAllRead } = useNotifications(20)

  const unreadCount = notifications.filter((n) => !n.read).length

  // Close on click outside
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, onClose])

  if (!open) return null

  function handleNotificationClick(n: { id: string; read: boolean; entity_type: string | null; entity_id: string | null }) {
    if (!n.read) {
      markRead(n.id)
    }
    // Entity link navigation
    if (n.entity_type && n.entity_id) {
      const routes: Record<string, string> = {
        opportunity: `/org/opportunities/${n.entity_id}`,
        project: `/org/projects/${n.entity_id}`,
        customer: `/org/management/customers/${n.entity_id}`,
        ticket: `/org/psa/tickets/${n.entity_id}`,
      }
      const route = routes[n.entity_type]
      if (route) {
        router.push(route)
        onClose()
      }
    }
  }

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full z-50 mt-1 w-[380px] overflow-hidden rounded-lg border border-border bg-card shadow-lg"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-[13px] font-semibold text-foreground">Notifications</h3>
          {unreadCount > 0 && (
            <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-500">
              {unreadCount} unread
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-[11px]"
            onClick={() => markAllRead()}
          >
            <CheckCheck className="h-3 w-3" />
            Mark all read
          </Button>
        )}
      </div>

      {/* List */}
      <div className="max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
            Loading...
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
            <Bell className="h-8 w-8 opacity-30" />
            <span className="text-xs">No notifications yet</span>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => handleNotificationClick(n)}
              className={`flex cursor-pointer items-start gap-3 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/50 ${
                !n.read ? 'bg-blue-500/[0.03]' : ''
              }`}
            >
              <div
                className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${
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
              {!n.read && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); markRead(n.id) }}
                  className="mt-1 shrink-0 rounded p-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Mark as read"
                >
                  <CheckCheck className="h-3 w-3" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
