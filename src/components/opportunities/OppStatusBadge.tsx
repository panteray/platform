'use client'

import { OPP_STATUS_LABELS } from '@/types/enums'

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  NEW: { bg: '#3b82f615', text: '#3b82f6' },
  ASSIGNED_TO_PRESALES: { bg: '#8b5cf615', text: '#8b5cf6' },
  SURVEY: { bg: '#06b6d415', text: '#06b6d4' },
  DESIGN: { bg: '#0ea5e915', text: '#0ea5e9' },
  WAITING_ON_INFO: { bg: '#f59e0b15', text: '#f59e0b' },
  SUBMITTED_FOR_QUOTE: { bg: '#f9731615', text: '#f97316' },
  AWAITING_SOW: { bg: '#f9731615', text: '#f97316' },
  SUBMITTED_TO_CUSTOMER: { bg: '#a855f715', text: '#a855f7' },
  AWAITING_PO: { bg: '#ec489915', text: '#ec4899' },
  AWAITING_SIGNED_DOCS: { bg: '#ec489915', text: '#ec4899' },
  PROJECT: { bg: '#22c55e15', text: '#22c55e' },
  AWAITING_DELIVERY: { bg: '#14b8a615', text: '#14b8a6' },
  INSTALL: { bg: '#10b98115', text: '#10b981' },
  QC: { bg: '#eab30815', text: '#eab308' },
  SIGN_OFF: { bg: '#84cc1615', text: '#84cc16' },
  CUSTOMER_SIGNATURE: { bg: '#22c55e15', text: '#22c55e' },
  COMPLETE: { bg: '#10b98120', text: '#10b981' },
  CLOSED: { bg: '#6b728015', text: '#6b7280' },
  ON_HOLD: { bg: '#f59e0b20', text: '#f59e0b' },
}

interface OppStatusBadgeProps {
  status: string
  size?: 'sm' | 'md'
}

export function OppStatusBadge({ status, size = 'sm' }: OppStatusBadgeProps) {
  const colors = STATUS_COLORS[status] ?? { bg: '#a1a1aa15', text: '#a1a1aa' }
  const label = OPP_STATUS_LABELS[status as keyof typeof OPP_STATUS_LABELS] ?? status.replace(/_/g, ' ')

  return (
    <span
      className={`inline-flex items-center rounded font-semibold ${
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
      }`}
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {label}
    </span>
  )
}
