'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { canManageUsers, canManageCRM } from '@/lib/roles'
import { DEVICE_LIBRARY_ROLES } from '@/types/enums'
import { useSidebarState } from '@/hooks/useSidebarState'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/* Brand SVG sprite icon — renders from /brand/panteray-icons-sprite.svg */
function PtIcon({ name, className }: { name: string; className?: string }) {
  return (
    <svg className={cn('pt-icon', className)} aria-hidden="true">
      <use href={`/brand/panteray-icons-sprite.svg#pt-${name}`} />
    </svg>
  )
}

const orgNav = [
  { href: '/org', label: 'Dashboard', icon: 'dashboard', exact: true, requiresAdmin: false, requiresCRM: false },
  { href: '/org/management', label: 'Management', icon: 'management', exact: false, requiresAdmin: false, requiresCRM: false },
]

const crmNav = [
  { href: '/org/opportunities', label: 'Opportunities', icon: 'opportunities', exact: false },
  { href: '/org/customers', label: 'Customers', icon: 'customers', exact: false },
  { href: '/org/manufacturers', label: 'Manufacturers', icon: 'manufacturers', exact: false },
  { href: '/org/subcontractors', label: 'Subcontractors', icon: 'subcontractors', exact: false },
  { href: '/org/distributors', label: 'Distributors', icon: 'distributors', exact: false },
]

const toolsNav = [
  { href: '/org/designs', label: 'Designs', icon: 'designs', exact: false },
  { href: '/org/tools/device-library', label: 'Device Library', icon: 'device-library', exact: false },
  { href: '/org/tools/calculators', label: 'Calculators', icon: 'calculators', exact: false },
]

const bottomNav = [
  { href: '/org/profile', label: 'Settings', icon: 'settings', exact: false },
]

function NavLink({
  item,
  active,
  collapsed,
}: {
  item: { href: string; label: string; icon: string }
  active: boolean
  collapsed: boolean
}) {
  const link = (
    <Link
      href={item.href}
      className={cn(
        'flex items-center rounded-lg text-[13px] font-normal transition-all duration-150',
        collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2',
        active
          ? 'bg-pt-purple/10 text-pt-purple-light dark:bg-pt-purple/15 dark:text-pt-purple-light'
          : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
      )}
    >
      <PtIcon name={item.icon} className={cn(active && 'text-pt-purple dark:text-pt-purple-light')} />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  )

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" className="text-xs font-normal">{item.label}</TooltipContent>
      </Tooltip>
    )
  }

  return link
}

export function OrgSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, userRole } = useUser()
  const { collapsed, toggle, mounted } = useSidebarState()

  const canManage = userRole ? canManageUsers(userRole) : false
  const canCRM = userRole ? canManageCRM(userRole) : false
  const canTools = userRole ? (DEVICE_LIBRARY_ROLES as readonly string[]).includes(userRole) : false

  const initials = user
    ? `${(user.first_name?.[0] ?? '').toUpperCase()}${(user.last_name?.[0] ?? '').toUpperCase()}`
    : '??'
  const displayName = user
    ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()
    : 'Loading...'

  function isActive(href: string, exact: boolean) {
    if (exact) return pathname === href
    return pathname.startsWith(href) && (href !== '/org' || pathname === '/org')
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-border/60 bg-card/80 backdrop-blur-sm transition-all duration-200',
        collapsed ? 'w-16 min-w-[64px]' : 'w-60 min-w-[240px]'
      )}
    >
      {/* Brand logo */}
      <div className="px-4 pb-3 pt-5">
        {collapsed ? (
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-primary-icon.svg" alt="Panteray" className="h-7 w-7" />
          </div>
        ) : (
          <div className="px-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo-primary-horizontal-dark.svg"
              alt="Panteray"
              className="hidden h-9 dark:block"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo-primary-horizontal-light.svg"
              alt="Panteray"
              className="block h-9 dark:hidden"
            />
          </div>
        )}
      </div>

      {/* User */}
      <div className={cn(
        'flex items-center border-b border-border/40 pb-4 pt-2',
        collapsed ? 'justify-center px-2' : 'gap-3 px-4'
      )}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pt-purple to-pt-purple-dark text-[11px] font-semibold text-white">
          {initials}
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium text-foreground">{displayName}</div>
            <div className="text-[11px] text-muted-foreground">{userRole ?? 'Loading...'}</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {orgNav
          .filter((item) => !item.requiresAdmin || canManage)
          .map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href, item.exact)} collapsed={collapsed} />
          ))}

        {/* CRM Section */}
        {canCRM && (
          <>
            <div className={cn('pb-1 pt-3', collapsed ? 'px-1' : 'px-2')}>
              <div className="border-t border-border/30" />
              {!collapsed && <p className="mt-2.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">CRM</p>}
            </div>
            {crmNav.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item.href, false)} collapsed={collapsed} />
            ))}
          </>
        )}

        {/* Tools Section */}
        {canTools && (
          <>
            <div className={cn('pb-1 pt-3', collapsed ? 'px-1' : 'px-2')}>
              <div className="border-t border-border/30" />
              {!collapsed && <p className="mt-2.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Tools</p>}
            </div>
            {toolsNav.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item.href, false)} collapsed={collapsed} />
            ))}
          </>
        )}

        {/* Settings */}
        <div className={cn('pt-3', collapsed ? 'px-1' : 'px-2')}>
          <div className="border-t border-border/30" />
        </div>
        {bottomNav.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href, false)} collapsed={collapsed} />
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-border/40">
        {mounted && (
          <div className={cn('py-1', collapsed ? 'px-2' : 'px-2')}>
            <button
              onClick={toggle}
              className={cn(
                'flex w-full items-center rounded-lg py-2 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground',
                collapsed ? 'justify-center px-2' : 'gap-3 px-3'
              )}
            >
              <PtIcon name="collapse" />
              {!collapsed && <span className="text-[13px]">Collapse</span>}
            </button>
          </div>
        )}

        <div className={cn('border-t border-border/40 py-1', collapsed ? 'px-2' : 'px-2')}>
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center justify-center rounded-lg p-2.5 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                >
                  <PtIcon name="sign-out" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs font-normal">Sign Out</TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
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
