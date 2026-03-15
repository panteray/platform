'use client'

import { Building2, Users, LayoutDashboard, PauseCircle } from 'lucide-react'
import type { Organization } from '@/types/database'

interface SummaryCardsProps {
  organizations: Organization[]
}

export function SummaryCards({ organizations }: SummaryCardsProps) {
  const active = organizations.filter((o) => o.status === 'active').length
  const suspended = organizations.filter((o) => o.status === 'suspended').length

  const cards = [
    { label: 'Organizations', value: organizations.length, icon: Building2, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Active orgs', value: active, icon: LayoutDashboard, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Suspended', value: suspended, icon: PauseCircle, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  ]

  return (
    <div className="grid grid-cols-3 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="flex items-start justify-between rounded-lg border border-border bg-card p-5">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{card.label}</div>
            <div className={`mt-2 text-3xl font-semibold ${card.color}`}>{card.value}</div>
          </div>
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.bg}`}>
            <card.icon className={`h-[18px] w-[18px] ${card.color}`} strokeWidth={1.5} />
          </div>
        </div>
      ))}
    </div>
  )
}
