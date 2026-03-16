'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Building2, PanelLeftClose, PanelLeft, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { useSidebarState } from '@/hooks/useSidebarState'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const adminNav = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, match: '/admin' },
  { href: '/admin/organizations', label: 'Organizations', icon: Building2, match: '/admin/organizations' },
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
              Admin Portal
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
      <nav className="flex-1 space-y-0.5 p-2">
        {adminNav.map((item) => {
          const active = item.match === '/admin'
            ? pathname === '/admin'
            : pathname.startsWith(item.match)

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
