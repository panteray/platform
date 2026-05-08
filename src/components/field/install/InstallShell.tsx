'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import {
  ArrowLeft, LayoutDashboard, Users, BadgeAlert,
  FileText, ClipboardCheck, MoreHorizontal, Menu, X,
} from 'lucide-react'

export type InstallSection = 'dashboard' | 'team' | 'co' | 'docs' | 'qc' | 'more'

interface Props {
  backHref: string
  pn: string | null
  name: string
  status: string
  siteAddress?: string | null
  active: InstallSection
  onChange: (s: InstallSection) => void
  children: ReactNode
}

const STATUS_COLOR: Record<string, string> = {
  planning:    'bg-blue-100 text-blue-700',
  active:      'bg-emerald-100 text-emerald-700',
  on_hold:     'bg-amber-100 text-amber-700',
  punch_list:  'bg-orange-100 text-orange-700',
  closeout:    'bg-purple-100 text-purple-700',
  completed:   'bg-muted text-muted-foreground',
  cancelled:   'bg-red-100 text-red-700',
}

const NAV: Array<{ key: InstallSection; label: string; icon: ReactNode }> = [
  { key: 'dashboard', label: 'Project Dash',    icon: <LayoutDashboard className="h-4 w-4" /> },
  { key: 'team',      label: 'Team & Subs',     icon: <Users className="h-4 w-4" /> },
  { key: 'co',        label: 'Change Orders',   icon: <BadgeAlert className="h-4 w-4" /> },
  { key: 'docs',      label: 'Documents',       icon: <FileText className="h-4 w-4" /> },
  { key: 'qc',        label: 'Quality Control', icon: <ClipboardCheck className="h-4 w-4" /> },
  { key: 'more',      label: 'More',            icon: <MoreHorizontal className="h-4 w-4" /> },
]

export function InstallShell({ backHref, pn, name, status, siteAddress, active, onChange, children }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="-m-6 flex h-[calc(100dvh-56px)] bg-background text-foreground md:h-[calc(100vh-56px)]">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-card">
        <SidebarHeader backHref={backHref} pn={pn} name={name} />
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => (
            <NavButton key={item.key} item={item} active={active === item.key} onClick={() => onChange(item.key)} />
          ))}
        </nav>
      </aside>

      {/* Drawer — phones */}
      {drawerOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-foreground/40 md:hidden"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card md:hidden">
            <div className="flex items-center justify-between p-3">
              <span className="text-xs font-semibold text-muted-foreground">Menu</span>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setDrawerOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <SidebarHeader backHref={backHref} pn={pn} name={name} />
            <nav className="flex-1 space-y-1 p-3">
              {NAV.map((item) => (
                <NavButton
                  key={item.key}
                  item={item}
                  active={active === item.key}
                  onClick={() => { onChange(item.key); setDrawerOpen(false) }}
                />
              ))}
            </nav>
          </aside>
        </>
      )}

      {/* Main column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-semibold text-primary">PN {pn ?? '—'}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_COLOR[status] ?? 'bg-muted text-muted-foreground'}`}>
                {status.replace('_', ' ')}
              </span>
            </div>
            <h1 className="truncate text-sm font-semibold leading-tight">{name}</h1>
            {siteAddress && <p className="truncate text-[11px] text-muted-foreground">{siteAddress}</p>}
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

function SidebarHeader({ backHref, pn, name }: { backHref: string; pn: string | null; name: string }) {
  return (
    <div className="border-b border-border p-4">
      <Link
        href={backHref}
        className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
        aria-label="Back to projects"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <div className="font-mono text-[10px] font-semibold text-primary">PN {pn ?? '—'}</div>
      <div className="mt-0.5 truncate text-sm font-semibold leading-tight">{name}</div>
    </div>
  )
}

function NavButton({
  item,
  active,
  onClick,
}: {
  item: { key: InstallSection; label: string; icon: ReactNode }
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-foreground hover:bg-muted'
      }`}
    >
      {item.icon}
      <span>{item.label}</span>
    </button>
  )
}

export function EmptySection({ title, note }: { title: string; note: string }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-sm rounded-2xl border border-dashed border-border bg-card p-8 text-center">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{note}</p>
      </div>
    </div>
  )
}
