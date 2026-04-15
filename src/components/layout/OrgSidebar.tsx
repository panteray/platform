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
  { href: '/org/management', label: 'Settings', icon: 'settings', exact: false, requiresAdmin: false, requiresCRM: false },
]

const crmNav = [
  { href: '/org/leads', label: 'Leads', icon: 'leads', exact: false },
  { href: '/org/opportunities', label: 'Opportunities', icon: 'opportunities', exact: false },
  { href: '/org/customers', label: 'Customers', icon: 'customers', exact: false },
  { href: '/org/manufacturers', label: 'Manufacturers', icon: 'manufacturers', exact: false },
  { href: '/org/subcontractors', label: 'Subcontractors', icon: 'subcontractors', exact: false },
  { href: '/org/distributors', label: 'Distributors', icon: 'distributors', exact: false },
]

const engineeringNav = [
  { href: '/org/surveys', label: 'Surveys', icon: 'surveys', exact: false },
  { href: '/org/designs', label: 'Designs', icon: 'designs', exact: false },
]

const deliveryNav = [
  { href: '/org/projects', label: 'Projects', icon: 'projects', exact: false },
  { href: '/org/assets', label: 'Assets', icon: 'device-library', exact: false },
  { href: '/org/field-ops', label: 'Field Ops', icon: 'management', exact: false },
]

const serviceNav = [
  { href: '/org/service', label: 'Service Desk', icon: 'management', exact: false },
  { href: '/org/compliance/technicians', label: 'Compliance', icon: 'management', exact: false },
]

const toolsNav = [
  { href: '/org/psa/kedb', label: 'KB', icon: 'device-library', exact: false },
  { href: '/org/tools/device-library', label: 'Device Library', icon: 'device-library', exact: false },
  { href: '/org/tools/calculators', label: 'Calculators', icon: 'calculators', exact: false },
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
      <PtIcon name={item.icon} className={cn(active && 'text-primary')} />
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
            <span className="font-display text-lg font-semibold tracking-tight text-foreground">Panteray</span>
          </div>
        )}
      </div>

      {/* User */}
      <div className={cn(
        'flex items-center border-b border-border pb-4 pt-2',
        collapsed ? 'justify-center px-2' : 'gap-3 px-4'
      )}>
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
              <div className="border-t border-border" />
              {!collapsed && <p className="mt-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">CRM</p>}
            </div>
            {crmNav.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item.href, false)} collapsed={collapsed} />
            ))}
          </>
        )}

        {/* Engineering Section */}
        {canCRM && (
          <>
            <div className={cn('pb-1 pt-3', collapsed ? 'px-1' : 'px-2')}>
              <div className="border-t border-border" />
              {!collapsed && <p className="mt-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Engineering</p>}
            </div>
            {engineeringNav.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item.href, false)} collapsed={collapsed} />
            ))}
          </>
        )}

        {/* Delivery Section */}
        {canCRM && (
          <>
            <div className={cn('pb-1 pt-3', collapsed ? 'px-1' : 'px-2')}>
              <div className="border-t border-border" />
              {!collapsed && <p className="mt-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Delivery</p>}
            </div>
            {deliveryNav.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item.href, false)} collapsed={collapsed} />
            ))}
          </>
        )}

        {/* Service Section */}
        {canCRM && (
          <>
            <div className={cn('pb-1 pt-3', collapsed ? 'px-1' : 'px-2')}>
              <div className="border-t border-border" />
              {!collapsed && <p className="mt-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Service</p>}
            </div>
            {serviceNav.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item.href, false)} collapsed={collapsed} />
            ))}
          </>
        )}

        {/* Tools Section */}
        {canTools && (
          <>
            <div className={cn('pb-1 pt-3', collapsed ? 'px-1' : 'px-2')}>
              <div className="border-t border-border" />
              {!collapsed && <p className="mt-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Tools</p>}
            </div>
            {toolsNav.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item.href, false)} collapsed={collapsed} />
            ))}
          </>
        )}
      </nav>

      {/* Bottom */}
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
