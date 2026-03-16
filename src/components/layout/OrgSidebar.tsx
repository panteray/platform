'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Settings, Users, Sliders, PanelLeftClose, PanelLeft, LogOut, Briefcase, Building2, Wrench, Factory, Truck, Cpu } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { canManageUsers, canManageCRM } from '@/lib/roles'
import { DEVICE_LIBRARY_ROLES } from '@/types/enums'
import { useSidebarState } from '@/hooks/useSidebarState'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const orgNav = [
  { href: '/org', label: 'Dashboard', icon: LayoutDashboard, exact: true, requiresAdmin: false, requiresCRM: false },
  { href: '/org/users', label: 'Users', icon: Users, exact: false, requiresAdmin: true, requiresCRM: false },
  { href: '/org/management', label: 'Management', icon: Sliders, exact: false, requiresAdmin: false, requiresCRM: false },
]

const crmNav = [
  { href: '/org/opportunities', label: 'Opportunities', icon: Briefcase, exact: false },
  { href: '/org/customers', label: 'Customers', icon: Building2, exact: false },
  { href: '/org/manufacturers', label: 'Manufacturers', icon: Factory, exact: false },
  { href: '/org/subcontractors', label: 'Subcontractors', icon: Wrench, exact: false },
  { href: '/org/distributors', label: 'Distributors', icon: Truck, exact: false },
]

const toolsNav = [
  { href: '/org/tools/device-library', label: 'Device Library', icon: Cpu, exact: false },
]

const bottomNav = [
  { href: '/org/profile', label: 'Settings', icon: Settings, exact: false },
]

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

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-border bg-zinc-950 transition-all duration-200',
        collapsed ? 'w-16 min-w-[64px]' : 'w-60 min-w-[240px]'
      )}
    >
      {/* Logo */}
      <div className="border-b border-border px-4 pb-4 pt-5">
        {collapsed ? (
          <div className="flex justify-center text-lg font-semibold text-white">P</div>
        ) : (
          <>
            <div className="px-2 text-xl font-semibold tracking-tight text-white">Panteray</div>
            <div className="mt-0.5 px-2 text-[10px] uppercase tracking-widest text-zinc-500">
              Organization
            </div>
          </>
        )}
      </div>

      {/* User */}
      <div className={cn('flex items-center gap-3 border-b border-border py-4', collapsed ? 'justify-center px-2' : 'px-4')}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[1.5px] border-blue-500 bg-zinc-900 text-sm font-medium text-white">
          {initials}
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium text-white">{displayName}</div>
            <div className="text-[11px] text-zinc-500">{userRole ?? 'Loading...'}</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {orgNav
          .filter((item) => !item.requiresAdmin || canManage)
          .map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href) && (item.href !== '/org' || pathname === '/org')

            const link = (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center rounded-md border-l-[3px] text-[13px] transition-colors',
                  collapsed ? 'justify-center px-2 py-2' : 'gap-2.5 px-4 py-2',
                  active
                    ? 'border-blue-500 bg-zinc-900 font-medium text-white'
                    : 'border-transparent text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-300'
                )}
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} />
                {!collapsed && item.label}
              </Link>
            )

            if (collapsed) {
              return (
                <Tooltip key={item.href} delayDuration={0}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">{item.label}</TooltipContent>
                </Tooltip>
              )
            }

            return link
          })}

        {/* CRM Section */}
        {canCRM && (
          <>
            <div className={cn('pt-2 pb-1', collapsed ? 'px-2' : 'px-4')}>
              <div className="border-t border-zinc-800" />
              {!collapsed && <p className="mt-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">CRM</p>}
            </div>
            {crmNav.map((item) => {
              const active = pathname.startsWith(item.href)

              const link = (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center rounded-md border-l-[3px] text-[13px] transition-colors',
                    collapsed ? 'justify-center px-2 py-2' : 'gap-2.5 px-4 py-2',
                    active
                      ? 'border-blue-500 bg-zinc-900 font-medium text-white'
                      : 'border-transparent text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-300'
                  )}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} />
                  {!collapsed && item.label}
                </Link>
              )

              if (collapsed) {
                return (
                  <Tooltip key={item.href} delayDuration={0}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right" className="text-xs">{item.label}</TooltipContent>
                  </Tooltip>
                )
              }

              return link
            })}
          </>
        )}

        {/* Tools Section */}
        {canTools && (
          <>
            <div className={cn('pt-2 pb-1', collapsed ? 'px-2' : 'px-4')}>
              <div className="border-t border-zinc-800" />
              {!collapsed && <p className="mt-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Tools</p>}
            </div>
            {toolsNav.map((item) => {
              const active = pathname.startsWith(item.href)

              const link = (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center rounded-md border-l-[3px] text-[13px] transition-colors',
                    collapsed ? 'justify-center px-2 py-2' : 'gap-2.5 px-4 py-2',
                    active
                      ? 'border-blue-500 bg-zinc-900 font-medium text-white'
                      : 'border-transparent text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-300'
                  )}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} />
                  {!collapsed && item.label}
                </Link>
              )

              if (collapsed) {
                return (
                  <Tooltip key={item.href} delayDuration={0}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right" className="text-xs">{item.label}</TooltipContent>
                  </Tooltip>
                )
              }

              return link
            })}
          </>
        )}

        {/* Settings */}
        <div className={cn('pt-2', collapsed ? 'px-2' : 'px-4')}>
          <div className="border-t border-zinc-800" />
        </div>
        {bottomNav.map((item) => {
          const active = pathname.startsWith(item.href)
          const link = (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center rounded-md border-l-[3px] text-[13px] transition-colors',
                collapsed ? 'justify-center px-2 py-2' : 'gap-2.5 px-4 py-2',
                active
                  ? 'border-blue-500 bg-zinc-900 font-medium text-white'
                  : 'border-transparent text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-300'
              )}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} />
              {!collapsed && item.label}
            </Link>
          )
          if (collapsed) {
            return (
              <Tooltip key={item.href} delayDuration={0}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" className="text-xs">{item.label}</TooltipContent>
              </Tooltip>
            )
          }
          return link
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-border">
        {/* Collapse toggle */}
        {mounted && (
          <div className={cn('py-1', collapsed ? 'px-2' : 'px-3')}>
            <button
              onClick={toggle}
              className={cn(
                'flex w-full items-center rounded-md py-2 text-zinc-500 transition-colors hover:bg-zinc-900/50 hover:text-zinc-300',
                collapsed ? 'justify-center px-2' : 'gap-2.5 px-4'
              )}
            >
              {collapsed ? (
                <PanelLeft className="h-[18px] w-[18px]" strokeWidth={1.5} />
              ) : (
                <>
                  <PanelLeftClose className="h-[18px] w-[18px]" strokeWidth={1.5} />
                  <span className="text-[13px]">Collapse</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Logout */}
        <div className={cn('border-t border-border py-1', collapsed ? 'px-2' : 'px-3')}>
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center justify-center rounded-md px-2 py-2 text-zinc-500 transition-colors hover:bg-zinc-900/50 hover:text-zinc-300"
                >
                  <LogOut className="h-[18px] w-[18px]" strokeWidth={1.5} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">Sign Out</TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 rounded-md px-4 py-2 text-[13px] text-zinc-500 transition-colors hover:bg-zinc-900/50 hover:text-zinc-300"
            >
              <LogOut className="h-[18px] w-[18px]" strokeWidth={1.5} />
              Sign Out
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
