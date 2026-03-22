'use client'

import { C, type RequirementStatus } from './constants'

export interface RequirementItem {
  label: string
  value: string | number
  unit: string
  status: RequirementStatus
  separator?: boolean
  /** Optional: required value for gauge display */
  required?: number
  /** Optional: in-project value for gauge display */
  inProject?: number
}

interface RequirementsBarProps {
  requirements: RequirementItem[]
  cableEstimate?: string
}

function getStatusColor(status: RequirementStatus): string {
  if (status === 'deficient') return C.red
  if (status === 'missing') return C.yellow
  return C.green
}

/** Circular SVG gauge ring — Axis Site Designer style */
function GaugeRing({ label, value, unit, max, color, size = 52 }: {
  label: string; value: number; unit: string; max: number; color: string; size?: number
}) {
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const pct = max > 0 ? Math.min(value / max, 1) : 0
  const strokeDash = circumference * pct
  const strokeGap = circumference - strokeDash

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
      minWidth: size + 8,
    }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background track */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={C.bgActive} strokeWidth={3.5}
        />
        {/* Filled arc — starts from top (rotated -90deg) */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={3.5}
          strokeDasharray={`${strokeDash} ${strokeGap}`}
          strokeDashoffset={circumference / 4}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        {/* Center value */}
        <text
          x={size / 2} y={size / 2 - 1}
          textAnchor="middle" dominantBaseline="central"
          fill={C.text} fontSize={size < 50 ? 10 : 11} fontWeight="700"
          fontFamily="'IBM Plex Mono', monospace"
        >
          {typeof value === 'number' && value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
        </text>
        {/* Unit below value */}
        <text
          x={size / 2} y={size / 2 + 10}
          textAnchor="middle" dominantBaseline="central"
          fill={C.textDim} fontSize={7}
          fontFamily="'IBM Plex Mono', monospace"
        >
          {unit}
        </text>
      </svg>
      <span style={{
        fontSize: 8, color: C.textMuted, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: 0.4,
        textAlign: 'center', lineHeight: 1,
      }}>
        {label}
      </span>
    </div>
  )
}

/** Compact count badge for device categories */
function CountBadge({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 6,
      background: C.bgActive, border: `1px solid ${C.borderSubtle}`,
    }}>
      {color && <div style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />}
      <span style={{ fontSize: 12, fontWeight: 700, color: C.text, fontFamily: "'IBM Plex Mono', monospace" }}>
        {value}
      </span>
      <span style={{ fontSize: 8, color: C.textDim, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </span>
    </div>
  )
}

export function RequirementsBar({ requirements, cableEstimate }: RequirementsBarProps) {
  const countItems = requirements.filter(r => !r.separator && r.required === undefined)
  const gaugeItems = requirements.filter(r => r.required !== undefined || r.separator)

  // Category colors
  const catColors: Record<string, string> = {
    'Cameras': '#3b82f6', 'Doors': '#f59e0b', 'Network': '#10b981',
    'AV': '#ec4899', 'Total': C.textMuted,
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', flexWrap: 'wrap',
      minHeight: 44, padding: '6px 12px', gap: 8,
      background: C.bgSurface, borderBottom: `1px solid ${C.border}`, flexShrink: 0,
      fontFamily: "'IBM Plex Mono', 'SF Mono', monospace",
    }}>
      {/* Device count badges */}
      {countItems.filter(r => Number(r.value) > 0).map((r) => (
        <CountBadge key={r.label} label={r.label} value={Number(r.value)} color={catColors[r.label]} />
      ))}

      {/* Separator */}
      {gaugeItems.length > 0 && (
        <div style={{ width: 1, height: 40, background: C.border, flexShrink: 0, marginLeft: 4, marginRight: 4 }} />
      )}

      {/* Circular gauge rings */}
      {gaugeItems.map((r) => {
        const val = typeof r.value === 'number' ? r.value : parseFloat(String(r.value)) || 0
        const max = r.required || val * 1.2 || 1
        return (
          <GaugeRing
            key={r.label}
            label={r.label}
            value={val}
            unit={r.unit}
            max={max}
            color={getStatusColor(r.status)}
          />
        )
      })}

      <div style={{ flex: 1 }} />

      {/* Cable estimate */}
      {cableEstimate && (
        <CountBadge label="Cable" value={0} />
      )}
      {cableEstimate && (
        <span style={{ fontSize: 10, fontWeight: 600, color: C.text }}>{cableEstimate}</span>
      )}
    </div>
  )
}
