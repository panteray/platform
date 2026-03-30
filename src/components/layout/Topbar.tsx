'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Search, Sun, Moon, Bell, ChevronRight } from 'lucide-react'
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
  '/org/opportunities': 'Opportunities',
  '/org/customers': 'Customers',
  '/org/manufacturers': 'Manufacturers',
  '/org/subcontractors': 'Subcontractors',
  '/org/distributors': 'Distributors',
  '/org/designs': 'Designs',
  '/org/tools/device-library': 'Device Library',
  '/org/tools/calculators': 'Calculators',
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
    else if (sub.startsWith('/opportunities')) crumbs.push({ label: 'Opportunities' })
    else if (sub.startsWith('/customers')) crumbs.push({ label: 'Customers' })
    else if (sub.startsWith('/manufacturers')) crumbs.push({ label: 'Manufacturers' })
    else if (sub.startsWith('/subcontractors')) crumbs.push({ label: 'Subcontractors' })
    else if (sub.startsWith('/distributors')) crumbs.push({ label: 'Distributors' })
    else if (sub.startsWith('/designs')) crumbs.push({ label: 'Designs' })
    else if (sub.startsWith('/tools/device-library')) crumbs.push({ label: 'Tools', href: '/org/tools/calculators' }, { label: 'Device Library' })
    else if (sub.startsWith('/tools/calculators')) crumbs.push({ label: 'Tools' }, { label: 'Calculators' })
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

  return (
    <header className="flex h-12 min-h-[48px] items-center justify-between border-b border-border/50 bg-card/60 px-5 backdrop-blur-sm">
      {/* Left: Breadcrumb + Search */}
      <div className="flex flex-1 items-center gap-5">
        {/* Breadcrumb */}
        <nav className="flex shrink-0 items-center gap-1.5 text-[13px]">
          {crumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/50" />}
              {crumb.href && i < crumbs.length - 1 ? (
                <button
                  onClick={() => router.push(crumb.href!)}
                  className="text-muted-foreground transition-colors hover:text-foreground"
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
        <div className="flex max-w-[320px] flex-1 items-center gap-2 rounded-lg border border-border/40 bg-background/50 px-3 py-1.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground/60" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
          />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5">
        {/* Notification Bell + Panel */}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="relative h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setNotifOpen((o) => !o)}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-pt-purple px-1 text-[9px] font-semibold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Button>
          <NotificationPanel open={notifOpen} onClose={handleCloseNotif} />
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        {roleLbl && (
          <span className="ml-1.5 rounded-md bg-pt-purple/10 px-2 py-0.5 text-[11px] font-medium text-pt-purple-light">
            {roleLbl}
          </span>
        )}
      </div>
    </header>
  )
}
