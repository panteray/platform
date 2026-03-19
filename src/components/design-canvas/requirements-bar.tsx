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

/** Compact chip for device counts */
function CountChip({ label, value, status }: { label: string; value: string | number; status: RequirementStatus }) {
  const color = status === 'normal' ? C.text : getStatusColor(status)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      {status !== 'normal' && (
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: getStatusColor(status), flexShrink: 0 }} />
      )}
      <span style={{ fontSize: 9, color: C.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color, fontFamily: "'IBM Plex Mono', monospace" }}>{value}</span>
    </div>
  )
}

/** Gauge bar: gray baseline (required), colored fill (in-project), delta badge */
function GaugeBar({ label, inProject, required, unit, status }: {
  label: string; inProject: number; required: number; unit: string; status: RequirementStatus
}) {
  const max = Math.max(inProject, required, 1)
  const fillPct = Math.min((inProject / max) * 100, 100)
  const reqPct = Math.min((required / max) * 100, 100)
  const delta = inProject - required
  const isSurplus = delta >= 0
  const fillColor = status === 'deficient' ? C.red : status === 'missing' ? C.yellow : C.green
  const deltaColor = isSurplus ? C.green : C.red

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 180 }}>
      <span style={{ fontSize: 9, color: C.textDim, textTransform: 'uppercase', letterSpacing: 0.4, width: 60, flexShrink: 0, textAlign: 'right' }}>
        {label}
      </span>
      <div style={{ position: 'relative', flex: 1, height: 8, minWidth: 80 }}>
        {/* Gray baseline (required) */}
        <div style={{
          position: 'absolute', left: 0, top: 0, height: '100%',
          width: `${reqPct}%`, background: C.bgActive, borderRadius: 4,
        }} />
        {/* Colored fill (in-project) */}
        <div style={{
          position: 'absolute', left: 0, top: 0, height: '100%',
          width: `${fillPct}%`, background: fillColor, borderRadius: 4,
          opacity: 0.85, transition: 'width 0.4s ease',
        }} />
        {/* Required marker line */}
        {required > 0 && (
          <div style={{
            position: 'absolute', left: `${reqPct}%`, top: -1, bottom: -1,
            width: 1.5, background: C.textDim, borderRadius: 1,
          }} />
        )}
      </div>
      {/* Dual value: inProject / required */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, flexShrink: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: C.text, fontFamily: "'IBM Plex Mono', monospace" }}>
          {typeof inProject === 'number' && !Number.isInteger(inProject) ? inProject.toFixed(1) : inProject}
        </span>
        {required > 0 && (
          <span style={{ fontSize: 8, color: C.textDim }}>/ {typeof required === 'number' && !Number.isInteger(required) ? required.toFixed(1) : required}</span>
        )}
        <span style={{ fontSize: 8, color: C.textDim }}>{unit}</span>
      </div>
      {/* Delta badge */}
      {required > 0 && delta !== 0 && (
        <span style={{
          fontSize: 8, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace",
          padding: '1px 5px', borderRadius: 3,
          background: `${deltaColor}14`,
          color: deltaColor,
          flexShrink: 0,
        }}>
          {isSurplus ? '+' : ''}{typeof delta === 'number' && !Number.isInteger(delta) ? delta.toFixed(1) : delta}
        </span>
      )}
    </div>
  )
}

export function RequirementsBar({ requirements, cableEstimate }: RequirementsBarProps) {
  // Split: device counts (no gauge) vs engineering metrics (with gauge)
  const countItems = requirements.filter(r => !r.separator && r.required === undefined)
  const gaugeItems = requirements.filter(r => r.required !== undefined || r.separator)

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap',
        minHeight: 36, padding: '4px 12px', gap: 12,
        background: C.bgSurface, borderBottom: `1px solid ${C.border}`, flexShrink: 0,
        fontFamily: "'IBM Plex Mono', 'SF Mono', monospace",
      }}
    >
      {/* Device count chips */}
      {countItems.map((r) => (
        <CountChip key={r.label} label={r.label} value={r.value} status={r.status} />
      ))}

      {/* Separator between counts and gauges */}
      {gaugeItems.length > 0 && (
        <div style={{ width: 1, height: 20, background: C.border, flexShrink: 0 }} />
      )}

      {/* Engineering gauge bars */}
      {gaugeItems.map((r) => (
        <GaugeBar
          key={r.label}
          label={r.label}
          inProject={typeof r.value === 'number' ? r.value : parseFloat(String(r.value)) || 0}
          required={r.required ?? 0}
          unit={r.unit}
          status={r.status}
        />
      ))}

      <div style={{ flex: 1 }} />

      {/* Cable estimate */}
      {cableEstimate && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 9, color: C.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>Cable Est.</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>{cableEstimate}</span>
        </div>
      )}
    </div>
  )
}
