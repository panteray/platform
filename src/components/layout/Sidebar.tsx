'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Building2, Cpu } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { useSidebarState } from '@/hooks/useSidebarState'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/* Brand SVG sprite icon */
function PtIcon({ name, className }: { name: string; className?: string }) {
  return (
    <svg className={cn('pt-icon', className)} aria-hidden="true">
      <use href={`/brand/panteray-icons-sprite.svg#pt-${name}`} />
    </svg>
  )
}

const adminNav = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, ptIcon: 'dashboard', match: '/admin' },
  { href: '/admin/organizations', label: 'Organizations', icon: Building2, ptIcon: 'manufacturers', match: '/admin/organizations' },
  { href: '/admin/device-library', label: 'Device Library', icon: Cpu, ptIcon: 'device-library', match: '/admin/device-library' },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, userRole } = useUser()
  const { collapsed, toggle, mounted } = useSidebarState()

  const initials = user
    ? `${(user.first_name?.[0] ?? '').toUpperCase()}${(user.last_name?.[0] ?? '').toUpperCase()}`
    : '??'
  const displayName = user
    ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()
    : 'Loading...'

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-border bg-card transition-all duration-200',
        collapsed ? 'w-16 min-w-[64px]' : 'w-60 min-w-[240px]'
      )}
    >
      {/* Brand logo */}
      <div className="px-4 pb-3 pt-5">
        {collapsed ? (
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-app-icon.svg" alt="Panteray" className="h-8 w-8 rounded-lg" />
          </div>
        ) : (
          <div className="flex items-center gap-2.5 px-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-app-icon.svg" alt="Panteray" className="h-8 w-8 rounded-lg" />
            <div>
              <span className="font-display text-lg font-semibold tracking-tight text-foreground">Panteray</span>
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Admin Portal</div>
            </div>
          </div>
        )}
      </div>

      {/* User */}
      <div className={cn('flex items-center border-b border-border pb-4 pt-2', collapsed ? 'justify-center px-2' : 'gap-3 px-4')}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pt-purple to-pt-purple-dark text-[11px] font-semibold text-white">
          {initials}
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-foreground">{displayName}</div>
            <div className="text-xs text-muted-foreground uppercase">{userRole ?? 'Loading...'}</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {adminNav.map((item) => {
          const active = item.match === '/admin'
            ? pathname === '/admin'
            : pathname.startsWith(item.match)

          const link = (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex items-center rounded-lg text-sm transition-all duration-150',
                collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2',
                active
                  ? 'bg-primary/15 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              {active && !collapsed && (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary" />
              )}
              <PtIcon name={item.ptIcon} className={cn(active && 'text-primary')} />
              {!collapsed && item.label}
            </Link>
          )

          if (collapsed) {
            return (
              <Tooltip key={item.href} delayDuration={0}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" className="text-xs font-normal">{item.label}</TooltipContent>
              </Tooltip>
            )
          }

          return link
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-border">
        {mounted && (
          <div className={cn('py-1', collapsed ? 'px-2' : 'px-2')}>
            <button
              onClick={toggle}
              className={cn(
                'flex w-full items-center rounded-lg py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                collapsed ? 'justify-center px-2' : 'gap-3 px-3'
              )}
            >
              <PtIcon name="collapse" />
              {!collapsed && <span className="text-sm">Collapse</span>}
            </button>
          </div>
        )}

        <div className={cn('border-t border-border py-1', collapsed ? 'px-2' : 'px-2')}>
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center justify-center rounded-lg p-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <PtIcon name="sign-out" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs font-normal">Sign Out</TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <PtIcon name="sign-out" />
              Sign Out
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
