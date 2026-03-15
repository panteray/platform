'use client'

import { useUser } from '@/hooks/useUser'
import { DIVISION_LABELS } from '@/lib/constants'
import type { UserDivision } from '@/types/enums'

interface DivisionFilterProps {
  value: string
  onChange: (division: string) => void
}

export function DivisionFilter({ value, onChange }: DivisionFilterProps) {
  const { user } = useUser()

  const divisions = (user?.divisions ?? []) as UserDivision[]

  // Hide filter if user has 0 or 1 division
  if (divisions.length <= 1) return null

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Division:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-input bg-secondary px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="ALL">All Divisions</option>
        {divisions.map((d) => (
          <option key={d} value={d}>
            {DIVISION_LABELS[d] ?? d}
          </option>
        ))}
      </select>
    </div>
  )
}
