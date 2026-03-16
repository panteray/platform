'use client'
import type { Opportunity } from '@/types/database'
import { OppStatus } from '@/types/enums'

function statusToStage(status: string): string {
  const s = status as OppStatus
  if ([OppStatus.NEW, OppStatus.ASSIGNED_TO_PRESALES].includes(s)) return 'active'
  if ([OppStatus.SURVEY, OppStatus.DESIGN, OppStatus.WAITING_ON_INFO].includes(s)) return 'design'
  if ([OppStatus.SUBMITTED_FOR_QUOTE, OppStatus.AWAITING_SOW, OppStatus.SUBMITTED_TO_CUSTOMER].includes(s)) return 'quoting'
  if ([OppStatus.AWAITING_PO, OppStatus.AWAITING_SIGNED_DOCS, OppStatus.PROJECT, OppStatus.AWAITING_DELIVERY, OppStatus.INSTALL, OppStatus.QC, OppStatus.SIGN_OFF, OppStatus.CUSTOMER_SIGNATURE].includes(s)) return 'execution'
  if (s === OppStatus.COMPLETE) return 'won'
  if (s === OppStatus.CLOSED) return 'declined'
  if (s === OppStatus.ON_HOLD) return 'active'
  return 'active'
}

interface Props { opportunities: Opportunity[] }

export function PipelineSummary({ opportunities }: Props) {
  const counts = { active: 0, design: 0, quoting: 0, execution: 0, won: 0, declined: 0 }
  for (const o of opportunities) { const stage = statusToStage(o.status); if (stage in counts) counts[stage as keyof typeof counts]++ }

  const cards = [
    { label: 'Active OPPs', count: counts.active, color: 'text-blue-500' },
    { label: 'Design Phase', count: counts.design, color: 'text-purple-500' },
    { label: 'Quoting', count: counts.quoting, color: 'text-amber-500' },
    { label: 'In Execution', count: counts.execution, color: 'text-green-500' },
    { label: 'Closed Won', count: counts.won, color: 'text-teal-500' },
    { label: 'Declined', count: counts.declined, color: 'text-red-500' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      {cards.map(({ label, count, color }) => (
        <div key={label} className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className={`text-xl font-semibold mt-0.5 ${color}`}>{count}</p>
        </div>
      ))}
    </div>
  )
}
