'use client'

import Link from 'next/link'
import { LeadPriorityBadge } from './LeadPriorityBadge'
import { LeadStatus } from '@/types/enums'
import type { Lead } from '@/types/database'

interface LeadKanbanProps {
  leads: Lead[]
  loading: boolean
}

const COLUMNS: { status: LeadStatus; label: string; color: string }[] = [
  { status: LeadStatus.NEW, label: 'New', color: '#3b82f6' },
  { status: LeadStatus.CONTACTED, label: 'Contacted', color: '#a855f7' },
  { status: LeadStatus.QUALIFYING, label: 'Qualifying', color: '#f59e0b' },
  { status: LeadStatus.QUALIFIED, label: 'Qualified', color: '#22c55e' },
  { status: LeadStatus.CONVERTED, label: 'Converted', color: '#10b981' },
  { status: LeadStatus.ARCHIVED, label: 'Archived', color: '#a1a1aa' },
]

export function LeadKanban({ leads, loading }: LeadKanbanProps) {
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading leads...</p>
      </div>
    )
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {COLUMNS.map((col) => {
        const colLeads = leads.filter((l) => l.status === col.status)
        return (
          <div
            key={col.status}
            className="flex w-[260px] min-w-[260px] flex-col rounded-lg border border-border bg-card"
          >
            {/* Column header */}
            <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: col.color }}
              />
              <span className="text-xs font-semibold">{col.label}</span>
              <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {colLeads.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 space-y-2 overflow-y-auto p-2" style={{ maxHeight: 'calc(100vh - 280px)' }}>
              {colLeads.length === 0 ? (
                <p className="py-4 text-center text-[10px] text-muted-foreground">No leads</p>
              ) : (
                colLeads.map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/org/leads/${lead.id}`}
                    className="block rounded-md border border-border bg-background p-2.5 transition-colors hover:border-foreground/20 hover:bg-muted/30"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {lead.contact_first_name} {lead.contact_last_name}
                        </p>
                        {lead.company_name && (
                          <p className="truncate text-xs text-muted-foreground">{lead.company_name}</p>
                        )}
                      </div>
                      <LeadPriorityBadge priority={lead.priority} />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-mono text-[10px] text-muted-foreground">{lead.lead_number}</span>
                      {lead.estimated_value != null && (
                        <span className="text-[10px] font-semibold text-foreground">
                          ${lead.estimated_value.toLocaleString()}
                        </span>
                      )}
                    </div>
                    {lead.source && (
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {lead.source.replace(/_/g, ' ')}
                      </p>
                    )}
                  </Link>
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
