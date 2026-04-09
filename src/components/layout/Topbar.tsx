'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Search, Sunrise, Sun, Sunset, Moon, Bell, ChevronRight, Check } from 'lucide-react'
import { useTheme, type Theme } from '@/components/layout/ThemeProvider'
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

const THEME_META: Record<Theme, { icon: typeof Sun; label: string }> = {
  morning: { icon: Sunrise, label: 'Morning' },
  daylight: { icon: Sun, label: 'Daylight' },
  dusk: { icon: Sunset, label: 'Dusk' },
  midnight: { icon: Moon, label: 'Midnight' },
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

function ThemeSelector() {
  const { theme, setTheme, themes } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const CurrentIcon = THEME_META[theme].icon

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={() => setOpen((o) => !o)}
        title={`Theme: ${THEME_META[theme].label}`}
      >
        <CurrentIcon className="h-4 w-4" />
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-44 overflow-hidden rounded-lg border border-border bg-card p-1 shadow-pt-md">
          {themes.map((t) => {
            const meta = THEME_META[t]
            const Icon = meta.icon
            const active = t === theme
            return (
              <button
                key={t}
                onClick={() => { setTheme(t); setOpen(false) }}
                className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${
                  active ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-accent'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{meta.label}</span>
                {active && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function Topbar() {
  const router = useRouter()
  const pathname = usePathname()
  const { notifications } = useNotifications(50)
  const { userRole } = useUser()
  const [notifOpen, setNotifOpen] = useState(false)

  const unreadCount = notifications.filter((n) => !n.read).length
  const handleCloseNotif = useCallback(() => setNotifOpen(false), [])
  const crumbs = useMemo(() => buildBreadcrumbs(pathname), [pathname])
  const roleLbl = userRole ? roleLabel(userRole as UserRole) : null

  return (
    <header className="flex h-12 min-h-[48px] items-center justify-between border-b border-border bg-card px-5">
      {/* Left: Breadcrumb + Search */}
      <div className="flex flex-1 items-center gap-5">
        {/* Breadcrumb */}
        <nav className="flex shrink-0 items-center gap-1.5 text-sm">
          {crumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/70" />}
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
        <div className="flex max-w-[320px] flex-1 items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-1.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
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
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Button>
          <NotificationPanel open={notifOpen} onClose={handleCloseNotif} />
        </div>
        <ThemeSelector />
        {roleLbl && (
          <span className="ml-1.5 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            {roleLbl}
          </span>
        )}
      </div>
    </header>
  )
}
