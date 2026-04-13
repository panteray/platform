'use client'

import Link from 'next/link'
import { OppStatusBadge } from './OppStatusBadge'
import { OPP_STATUS_ORDER, OPP_STATUS_LABELS, OppStatus } from '@/types/enums'
import type { Opportunity } from '@/types/database'

interface OppKanbanProps {
  opportunities: Opportunity[]
  loading: boolean
}

// Group statuses into lanes to avoid 19 narrow columns
const KANBAN_LANES: { label: string; statuses: OppStatus[] }[] = [
  { label: 'Lead', statuses: [OppStatus.NEW, OppStatus.ASSIGNED_TO_PRESALES] },
  { label: 'Presales', statuses: [OppStatus.SURVEY, OppStatus.DESIGN, OppStatus.WAITING_ON_INFO] },
  { label: 'Quoting', statuses: [OppStatus.SUBMITTED_FOR_QUOTE, OppStatus.AWAITING_SOW] },
  { label: 'Proposal', statuses: [OppStatus.SUBMITTED_TO_CUSTOMER, OppStatus.AWAITING_PO, OppStatus.AWAITING_SIGNED_DOCS] },
  { label: 'Execution', statuses: [OppStatus.PROJECT, OppStatus.AWAITING_DELIVERY, OppStatus.INSTALL] },
  { label: 'Closeout', statuses: [OppStatus.QC, OppStatus.SIGN_OFF, OppStatus.CUSTOMER_SIGNATURE] },
  { label: 'Won', statuses: [OppStatus.COMPLETE] },
  { label: 'Lost / Hold', statuses: [OppStatus.CLOSED, OppStatus.ON_HOLD] },
]

const LANE_COLORS: Record<string, string> = {
  Lead: '#3b82f6',
  Presales: '#8b5cf6',
  Quoting: '#f97316',
  Proposal: '#a855f7',
  Execution: '#22c55e',
  Closeout: '#eab308',
  Won: '#10b981',
  'Lost / Hold': '#6b7280',
}

export function OppKanban({ opportunities, loading }: OppKanbanProps) {
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading opportunities...</p>
      </div>
    )
  }

  return (
    <div className="flex gap-2.5 overflow-x-auto pb-4">
      {KANBAN_LANES.map((lane) => {
        const cards = opportunities.filter((o) =>
          lane.statuses.includes(o.status as OppStatus)
        )
        const laneColor = LANE_COLORS[lane.label] ?? '#a1a1aa'
        const totalValue = cards.reduce(
          (s, o) => s + Number(o.quote_amount ?? o.order_amount ?? 0),
          0
        )

        return (
          <div
            key={lane.label}
            className="flex w-56 shrink-0 flex-col rounded-lg border border-border bg-muted/20"
          >
            {/* Lane header */}
            <div className="border-b border-border px-3 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: laneColor }}
                  />
                  <span className="text-xs font-semibold">{lane.label}</span>
                </div>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                  {cards.length}
                </span>
              </div>
              {totalValue > 0 && (
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  ${totalValue.toLocaleString()}
                </p>
              )}
            </div>

            {/* Cards */}
            <div className="flex-1 space-y-1.5 overflow-y-auto p-2" style={{ maxHeight: '60vh' }}>
              {cards.length === 0 ? (
                <p className="py-4 text-center text-[10px] text-muted-foreground">Empty</p>
              ) : (
                cards.map((opp) => {
                  const cust = (opp as unknown as Record<string, unknown>).customers as {
                    name?: string
                  } | null

                  return (
                    <Link
                      key={opp.id}
                      href={`/org/opportunities/${opp.id}`}
                      className="block rounded-md border border-border bg-card p-2.5 hover:border-primary/30 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {opp.opp_number}
                        </span>
                        {opp.opp_type && (
                          <span className="rounded border border-border px-1.5 py-0.5 text-[9px] font-semibold">
                            {opp.opp_type}
                          </span>
                        )}
                      </div>
                      {opp.project_name && (
                        <p className="mt-1 text-xs font-medium text-foreground truncate">
                          {opp.project_name}
                        </p>
                      )}
                      {cust?.name && (
                        <p className="mt-0.5 text-[10px] text-muted-foreground truncate">
                          {cust.name}
                        </p>
                      )}
                      <div className="mt-1.5 flex items-center justify-between">
                        <OppStatusBadge status={opp.status} />
                        {opp.quote_amount != null && (
                          <span className="text-[10px] font-semibold text-emerald-500">
                            ${Number(opp.quote_amount).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </Link>
                  )
                })
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
