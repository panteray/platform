'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Search, Sun, Moon, HelpCircle, LogOut, Bell, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/components/layout/ThemeProvider'
import { useNotifications } from '@/hooks/useNotifications'
import { NotificationPanel } from '@/components/layout/NotificationPanel'
import { useUser } from '@/hooks/useUser'
import { roleLabel } from '@/lib/roles'
import { Button } from '@/components/ui/button'
import type { UserRole } from '@/types/enums'

const ROUTE_LABELS: Record<string, string> = {
  '/admin': 'Admin',
  '/admin/organizations': 'Organizations',
  '/org': 'Dashboard',
  '/org/management': 'Management',
  '/org/profile': 'Profile',
  '/org/settings': 'Organization',
  '/org/users': 'Users',
  '/dashboard': 'Dashboard',
}

function buildBreadcrumbs(pathname: string): { label: string; href?: string }[] {
  const crumbs: { label: string; href?: string }[] = []

  if (pathname.startsWith('/admin')) {
    crumbs.push({ label: 'Platform', href: '/admin' })
    if (pathname.startsWith('/admin/organizations')) {
      crumbs.push({ label: 'Organizations' })
    }
  } else if (pathname.startsWith('/org')) {
    crumbs.push({ label: 'Platform', href: '/org' })
    const sub = pathname.replace('/org', '')
    if (sub.startsWith('/management')) crumbs.push({ label: 'Management' })
    else if (sub.startsWith('/profile')) crumbs.push({ label: 'Management', href: '/org/management' }, { label: 'Profile' })
    else if (sub.startsWith('/settings')) crumbs.push({ label: 'Management', href: '/org/management' }, { label: 'Organization' })
    else if (sub.startsWith('/users')) crumbs.push({ label: 'Users' })
    else crumbs.push({ label: 'Dashboard' })
  } else {
    crumbs.push({ label: 'Platform' })
  }

  return crumbs
}

export function Topbar() {
  const router = useRouter()
  const pathname = usePathname()
  const { theme, toggleTheme } = useTheme()
  const { notifications } = useNotifications(50)
  const { userRole } = useUser()
  const [notifOpen, setNotifOpen] = useState(false)

  const unreadCount = notifications.filter((n) => !n.read).length
  const handleCloseNotif = useCallback(() => setNotifOpen(false), [])

  const crumbs = useMemo(() => buildBreadcrumbs(pathname), [pathname])
  const roleLbl = userRole ? roleLabel(userRole as UserRole) : null

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="flex h-14 min-h-[56px] items-center justify-between border-b border-border bg-card px-6">
      {/* Left: Breadcrumb + Search */}
      <div className="flex flex-1 items-center gap-4">
        {/* Breadcrumb */}
        <nav className="flex shrink-0 items-center gap-1.5 text-[13px]">
          {crumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
              {crumb.href && i < crumbs.length - 1 ? (
                <button
                  onClick={() => router.push(crumb.href!)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {crumb.label}
                </button>
              ) : (
                <span className={i === crumbs.length - 1 ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                  {crumb.label}
                </span>
              )}
            </span>
          ))}
        </nav>

        {/* Search */}
        <div className="flex max-w-[360px] flex-1 items-center gap-2 rounded-md border border-input bg-secondary px-3 py-1.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        {/* Notification Bell + Panel */}
        <div className="relative">
          <Button
            variant="outline"
            size="icon"
            className="relative h-[34px] w-[34px]"
            onClick={() => setNotifOpen((o) => !o)}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-500 px-1 text-[9px] font-semibold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Button>
          <NotificationPanel open={notifOpen} onClose={handleCloseNotif} />
        </div>
        <Button variant="outline" size="icon" onClick={toggleTheme} className="h-[34px] w-[34px]">
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        {roleLbl && (
          <span className="ml-2 text-xs text-muted-foreground">{roleLbl}</span>
        )}
        <Button variant="outline" size="sm" className="ml-1 gap-1.5" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </header>
  )
}
