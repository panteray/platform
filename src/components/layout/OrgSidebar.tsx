'use client'

import { useEffect, useLayoutEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  ChevronDown, LayoutDashboard, Sparkles, Target, Building2, Factory, HardHat, Truck,
  ClipboardCheck, Ruler, FolderKanban, Package, Wrench, Sun, Headphones, ShieldCheck,
  BookOpen, Boxes, Calculator, Settings as SettingsIcon, PanelLeft, LogOut,
  type LucideIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { canManageUsers, canManageCRM } from '@/lib/roles'
import { DEVICE_LIBRARY_ROLES } from '@/types/enums'
import { useSidebarState } from '@/hooks/useSidebarState'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  color: string
  exact?: boolean
  requiresAdmin?: boolean
  requiresCRM?: boolean
}

const orgNav: NavItem[] = [
  { href: '/org', label: 'Dashboard', icon: LayoutDashboard, color: 'text-blue-500', exact: true },
]

const settingsNav: NavItem[] = [
  { href: '/org/management', label: 'Management', icon: SettingsIcon, color: 'text-slate-500' },
]

const crmNav: NavItem[] = [
  { href: '/org/leads', label: 'Leads', icon: Sparkles, color: 'text-pink-500' },
  { href: '/org/opportunities', label: 'Opportunities', icon: Target, color: 'text-amber-500' },
  { href: '/org/customers', label: 'Customers', icon: Building2, color: 'text-cyan-500' },
  { href: '/org/manufacturers', label: 'Manufacturers', icon: Factory, color: 'text-orange-500' },
  { href: '/org/subcontractors', label: 'Subcontractors', icon: HardHat, color: 'text-yellow-500' },
  { href: '/org/distributors', label: 'Distributors', icon: Truck, color: 'text-sky-500' },
]

const engineeringNav: NavItem[] = [
  { href: '/org/surveys', label: 'Surveys', icon: ClipboardCheck, color: 'text-teal-500' },
  { href: '/org/designs', label: 'Designs', icon: Ruler, color: 'text-violet-500' },
]

const deliveryNav: NavItem[] = [
  { href: '/org/projects', label: 'Projects', icon: FolderKanban, color: 'text-indigo-500' },
  { href: '/org/assets', label: 'Assets', icon: Package, color: 'text-rose-500' },
  { href: '/org/field-ops', label: 'Field Ops', icon: Wrench, color: 'text-emerald-600' },
]

const serviceNav: NavItem[] = [
  { href: '/org/field', label: 'My Day', icon: Sun, color: 'text-amber-500' },
  { href: '/org/service', label: 'Service Desk', icon: Headphones, color: 'text-blue-600' },
  { href: '/org/compliance/technicians', label: 'Compliance', icon: ShieldCheck, color: 'text-green-600' },
]

const toolsNav: NavItem[] = [
  { href: '/org/psa/kedb', label: 'KB', icon: BookOpen, color: 'text-purple-500' },
  { href: '/org/tools/device-library', label: 'Device Library', icon: Boxes, color: 'text-fuchsia-500' },
  { href: '/org/tools/calculators', label: 'Calculators', icon: Calculator, color: 'text-lime-600' },
]

function NavLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem
  active: boolean
  collapsed: boolean
}) {
  const Icon = item.icon
  const link = (
    <Link
      href={item.href}
      className={cn(
        'relative flex items-center rounded-lg text-sm transition-all duration-150',
        collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2',
        active
          ? 'bg-primary/15 text-foreground font-medium'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      )}
    >
      {active && !collapsed && (
        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary" />
      )}
      <Icon className={cn('h-[18px] w-[18px] shrink-0', item.color)} strokeWidth={2} />
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

const SECTION_STORAGE_KEY = 'panteray.sidebar.sections'
type SectionKey = 'crm' | 'engineering' | 'delivery' | 'service' | 'tools' | 'settings'
const DEFAULT_OPEN: Record<SectionKey, boolean> = {
  crm: true, engineering: true, delivery: true, service: true, tools: true, settings: true,
}

function useSectionState() {
  const [open, setOpen] = useState<Record<SectionKey, boolean>>(DEFAULT_OPEN)
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    try {
      const raw = localStorage.getItem(SECTION_STORAGE_KEY)
      if (raw) setOpen({ ...DEFAULT_OPEN, ...JSON.parse(raw) })
    } catch {}
  }, [])
  const toggle = (k: SectionKey) => {
    setOpen((prev) => {
      const next = { ...prev, [k]: !prev[k] }
      try { localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }
  return { open, toggle, mounted }
}

function SectionHeader({ label, isOpen, onToggle, collapsed }: { label: string; isOpen: boolean; onToggle: () => void; collapsed: boolean }) {
  return (
    <div className={cn('pb-1 pt-3', collapsed ? 'px-1' : 'px-2')}>
      <div className="border-t border-border" />
      {!collapsed && (
        <button
          onClick={onToggle}
          className="mt-2 flex w-full items-center justify-between rounded px-1 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground"
        >
          <span>{label}</span>
          <ChevronDown className={cn('h-3 w-3 transition-transform', !isOpen && '-rotate-90')} />
        </button>
      )}
    </div>
  )
}

export function OrgSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, userRole } = useUser()
  const { collapsed, toggle, mounted, mobileOpen, closeMobile } = useSidebarState()
  const sections = useSectionState()

  // Force browser to reflow when drawer opens/closes; without this,
  // Chromium can cache the composited position during dev HMR.
  useLayoutEffect(() => {
    const el = document.getElementById('pt-mobile-drawer')
    if (el) { el.style.display = 'none'; void el.offsetHeight; el.style.display = '' }
  }, [mobileOpen])

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
    if (href === '/org') return pathname === '/org'
    return pathname === href || pathname.startsWith(href + '/')
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Mobile backdrop */}
      <div
        onClick={closeMobile}
        className={cn(
          'fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity md:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        aria-hidden="true"
      />
    <aside
      id="pt-mobile-drawer"
      data-mobile-open={mobileOpen}
      className={cn(
        'pt-mobile-drawer flex flex-col border-r border-border bg-card',
        'fixed inset-y-0 z-50 w-64 md:static md:z-auto md:w-auto md:left-auto',
        collapsed ? 'md:w-16 md:min-w-[64px]' : 'md:w-60 md:min-w-[240px]'
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
            <NavLink key={item.href} item={item} active={isActive(item.href, item.exact ?? false)} collapsed={collapsed} />
          ))}

        {/* CRM Section */}
        {canCRM && (
          <>
            <SectionHeader label="CRM" isOpen={sections.open.crm} onToggle={() => sections.toggle('crm')} collapsed={collapsed} />
            {(collapsed || sections.open.crm) && crmNav.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item.href, false)} collapsed={collapsed} />
            ))}
          </>
        )}

        {/* Engineering Section */}
        {canCRM && (
          <>
            <SectionHeader label="Engineering" isOpen={sections.open.engineering} onToggle={() => sections.toggle('engineering')} collapsed={collapsed} />
            {(collapsed || sections.open.engineering) && engineeringNav.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item.href, false)} collapsed={collapsed} />
            ))}
          </>
        )}

        {/* Delivery Section */}
        {canCRM && (
          <>
            <SectionHeader label="Delivery" isOpen={sections.open.delivery} onToggle={() => sections.toggle('delivery')} collapsed={collapsed} />
            {(collapsed || sections.open.delivery) && deliveryNav.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item.href, false)} collapsed={collapsed} />
            ))}
          </>
        )}

        {/* Service Section */}
        {canCRM && (
          <>
            <SectionHeader label="Service" isOpen={sections.open.service} onToggle={() => sections.toggle('service')} collapsed={collapsed} />
            {(collapsed || sections.open.service) && serviceNav.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item.href, false)} collapsed={collapsed} />
            ))}
          </>
        )}

        {/* Tools Section */}
        {canTools && (
          <>
            <SectionHeader label="Tools" isOpen={sections.open.tools} onToggle={() => sections.toggle('tools')} collapsed={collapsed} />
            {(collapsed || sections.open.tools) && toolsNav.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item.href, false)} collapsed={collapsed} />
            ))}
          </>
        )}

        {/* Settings Section */}
        <SectionHeader label="Settings" isOpen={sections.open.settings} onToggle={() => sections.toggle('settings')} collapsed={collapsed} />
        {(collapsed || sections.open.settings) && settingsNav.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href, false)} collapsed={collapsed} />
        ))}
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
              <PanelLeft className="h-[18px] w-[18px] shrink-0" />
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
                  <LogOut className="h-[18px] w-[18px] shrink-0" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs font-normal">Sign Out</TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <LogOut className="h-[18px] w-[18px] shrink-0" />
              Sign Out
            </button>
          )}
        </div>
      </div>
      </aside>
    </>
  )
}
