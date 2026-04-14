'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

export type ServiceTab =
  | 'tickets'
  | 'dispatch'
  | 'problems'
  | 'wip'
  | 'invoices'
  | 'contracts'
  | 'docs'
  | 'ar-aging'
  | 'rmr'

const TABS: { key: ServiceTab; label: string; href: string }[] = [
  { key: 'tickets',   label: 'Tickets',           href: '/org/service/tickets' },
  { key: 'dispatch',  label: 'Dispatch',          href: '/org/service/dispatch' },
  { key: 'problems',  label: 'Problems',          href: '/org/service/problems' },
  { key: 'wip',       label: 'WIP Report',        href: '/org/service/wip' },
  { key: 'invoices',  label: 'Invoices',          href: '/org/service/invoices' },
  { key: 'contracts', label: 'Service Contracts', href: '/org/service/contracts' },
  { key: 'docs',      label: 'Contracts & Docs',  href: '/org/service/docs' },
  { key: 'ar-aging',  label: 'AR Aging',          href: '/org/service/ar-aging' },
  { key: 'rmr',       label: 'RMR',               href: '/org/service/rmr' },
]

export function ServiceShell({ activeTab, children }: { activeTab: ServiceTab; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border bg-card/40">
        <div className="flex items-center gap-1 overflow-x-auto px-4 pt-3">
          <h1 className="mr-4 text-base font-bold text-foreground whitespace-nowrap">Service Desk</h1>
          <nav className="flex items-center gap-0.5">
            {TABS.map((t) => {
              const active = t.key === activeTab
              return (
                <Link
                  key={t.key}
                  href={t.href}
                  className={cn(
                    'relative whitespace-nowrap rounded-t-md px-3 py-2 text-xs font-medium transition-colors',
                    active
                      ? 'bg-background text-primary border-x border-t border-border -mb-px'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/40',
                  )}
                >
                  {t.label}
                  {active && (
                    <span className="absolute inset-x-0 -bottom-px h-px bg-background" />
                  )}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {children}
      </div>
    </div>
  )
}
