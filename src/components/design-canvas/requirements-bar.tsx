'use client'

import { C, type RequirementStatus } from './constants'

export interface RequirementItem {
  label: string
  value: string | number
  unit: string
  status: RequirementStatus
  separator?: boolean
}

interface RequirementsBarProps {
  requirements: RequirementItem[]
  cableEstimate?: string
}

function getValueColor(status: RequirementStatus): string {
  if (status === 'deficient') return C.red
  if (status === 'missing') return C.yellow
  return C.text
}

export function RequirementsBar({ requirements, cableEstimate }: RequirementsBarProps) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', height: 36,
        background: C.bgSurface, borderBottom: `1px solid ${C.border}`,
        padding: '0 12px', gap: 16, flexShrink: 0,
        fontFamily: "'IBM Plex Mono', 'SF Mono', monospace",
      }}
    >
      {requirements.map((r) => (
        <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {r.separator && (
            <div style={{ width: 1, height: 16, background: C.border, marginRight: 16 }} />
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {r.status !== 'normal' && (
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: getValueColor(r.status), flexShrink: 0 }} />
            )}
            <span style={{ fontSize: 10, color: C.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {r.label}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: getValueColor(r.status) }}>
              {r.value}
            </span>
            {r.unit && (
              <span style={{ fontSize: 10, color: r.status === 'normal' ? C.textMuted : getValueColor(r.status), opacity: r.status === 'normal' ? 1 : 0.7 }}>
                {r.unit}
              </span>
            )}
          </div>
        </div>
      ))}
      <div style={{ flex: 1 }} />
      {cableEstimate && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 10, color: C.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>Cable Est.</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{cableEstimate}</span>
        </div>
      )}
    </div>
  )
}
