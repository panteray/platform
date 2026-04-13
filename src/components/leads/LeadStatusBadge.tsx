'use client'

import { LeadStatus } from '@/types/enums'

const STATUS_STYLES: Record<string, { bg: string; fg: string }> = {
  [LeadStatus.NEW]: { bg: 'rgba(59,130,246,0.12)', fg: '#3b82f6' },
  [LeadStatus.CONTACTED]: { bg: 'rgba(168,85,247,0.12)', fg: '#a855f7' },
  [LeadStatus.QUALIFYING]: { bg: 'rgba(245,158,11,0.12)', fg: '#f59e0b' },
  [LeadStatus.QUALIFIED]: { bg: 'rgba(34,197,94,0.12)', fg: '#22c55e' },
  [LeadStatus.CONVERTED]: { bg: 'rgba(16,185,129,0.12)', fg: '#10b981' },
  [LeadStatus.ARCHIVED]: { bg: 'rgba(161,161,170,0.12)', fg: '#a1a1aa' },
}

export function LeadStatusBadge({ status }: { status: string | null }) {
  const s = STATUS_STYLES[status ?? ''] ?? { bg: 'rgba(161,161,170,0.12)', fg: '#a1a1aa' }
  return (
    <span
      style={{
        background: s.bg,
        color: s.fg,
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 4,
        whiteSpace: 'nowrap',
      }}
    >
      {status ?? '—'}
    </span>
  )
}
