'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Building2, HelpCircle } from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { cn } from '@/lib/utils'

const adminNav = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, match: '/admin' },
  { href: '/admin/organizations', label: 'Organizations', icon: Building2, match: '/admin/organizations' },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, userRole } = useUser()

  const initials = user
    ? `${(user.first_name?.[0] ?? '').toUpperCase()}${(user.last_name?.[0] ?? '').toUpperCase()}`
    : '??'
  const displayName = user
    ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()
    : 'Loading...'

  return (
    <aside className="flex w-60 min-w-[240px] flex-col border-r border-border bg-zinc-950">
      {/* Logo */}
      <div className="border-b border-border px-6 pb-4 pt-5">
        <div className="text-xl font-semibold tracking-tight text-white">Panteray</div>
        <div className="mt-0.5 text-[10px] uppercase tracking-widest text-zinc-500">
          Admin Portal
        </div>
      </div>

      {/* User */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-blue-500 bg-zinc-900 text-sm font-medium text-white">
          {initials}
        </div>
        <div>
          <div className="text-[13px] font-medium text-white">{displayName}</div>
          <div className="text-[11px] text-zinc-500">{userRole ?? 'Loading...'}</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 p-2">
        {adminNav.map((item) => {
          const active = item.match === '/admin'
            ? pathname === '/admin'
            : pathname.startsWith(item.match)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 rounded-md border-l-[3px] px-4 py-2 text-[13px] transition-colors',
                active
                  ? 'border-blue-500 bg-zinc-900 font-medium text-white'
                  : 'border-transparent text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-300'
              )}
            >
              <item.icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="flex items-center gap-2 border-t border-border px-4 py-3 text-[11px] text-zinc-500">
        <HelpCircle className="h-4 w-4 opacity-50" />
        Help & Support
      </div>
    </aside>
  )
}
