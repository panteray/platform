'use client'

import { LeadPriority } from '@/types/enums'

const PRIORITY_STYLES: Record<string, { bg: string; fg: string }> = {
  [LeadPriority.HOT]: { bg: 'rgba(239,68,68,0.12)', fg: '#ef4444' },
  [LeadPriority.WARM]: { bg: 'rgba(245,158,11,0.12)', fg: '#f59e0b' },
  [LeadPriority.COLD]: { bg: 'rgba(59,130,246,0.12)', fg: '#3b82f6' },
}

export function LeadPriorityBadge({ priority }: { priority: string | null }) {
  const s = PRIORITY_STYLES[priority ?? ''] ?? { bg: 'rgba(161,161,170,0.12)', fg: '#a1a1aa' }
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
      {priority ?? '—'}
    </span>
  )
}
