'use client'

import { SURVEY_STATUSES } from '@/lib/survey-constants'

interface Props {
  status: string
}

export function SurveyStatusBadge({ status }: Props) {
  const s = SURVEY_STATUSES.find(st => st.value === status)
  const color = s?.color || '#6b7280'
  const label = s?.label || status

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ backgroundColor: `${color}18`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}
