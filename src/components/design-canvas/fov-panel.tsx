'use client'
/**
 * FovPanel — Full FoV editor panel (Hanwha DesignPro pattern).
 *
 * 680px wide, stacks left of the right panel.
 * Controls: H-FoV, Installation Height, Target Distance, Tilt Angle
 * Density: DORI tiles with PPM/PPF values
 * Views: Side-by-side Side View + Top View SVG diagrams
 *
 * Data cross-references from canvas device properties.
 */

import React, { useMemo, useRef, useCallback } from 'react'
import { X } from 'lucide-react'
import { C } from './constants'
import { calculatePpfAtDistance, classifyDori } from '@/lib/calculators'
import type { DesignDevice } from '@/types/database'

interface Props {
  device: DesignDevice
  onClose: () => void
  onUpdateDevice: (id: string, updates: Record<string, unknown>) => void
}

const DORI_TIERS = [
  { key: 'identification', label: 'Identification', ppm: 250, ppf: 76 },
  { key: 'recognition', label: 'Recognition', ppm: 125, ppf: 38 },
  { key: 'observation', label: 'Observation', ppm: 63, ppf: 19 },
  { key: 'detection', label: 'Detection', ppm: 25, ppf: 8 },
  { key: 'monitor', label: 'Monitoring', ppm: 13, ppf: 4 },
] as const

export function FovPanel({ device, onClose, onUpdateDevice }: Props) {
  const props = useMemo(() => (device.properties ?? {}) as Record<string, unknown>, [device.properties])

  const focalLength = Number(props.focal_length) || 4
  const targetDist = Number(props.target_distance) || 30
  const installHeight = Number(props.install_height) || 9
  const tiltAngle = Number(props.tilt_angle) || 0
  const sensorW = Number(props.sensor_w) || Number(props.sensor_width) || 0
  const resolutionW = Number(props.resolution_w) || 0
  const resolutionH = Number(props.resolution_h) || 0

  // Parse varifocal lens range from focal_length string (e.g. "3.7 - 9.4" or "3.7")
  const focalLengthStr = String(props.focal_length || props.focal_length_mm || '')
  const focalParts = focalLengthStr.match(/([\d.]+)\s*[-~]\s*([\d.]+)/)
  const focalMin = focalParts ? parseFloat(focalParts[1]) : focalLength
  const focalMax = focalParts ? parseFloat(focalParts[2]) : focalLength
  const isVarifocal = focalMax > focalMin

  // Compute H-FoV from current focal length + sensor width
  const hFov = sensorW > 0 && focalLength > 0
    ? 2 * Math.atan(sensorW / (2 * focalLength)) * (180 / Math.PI)
    : Number(props.fov_angle) || 90

  // H-FoV range from varifocal lens (wider FOV = shorter focal length)
  const hFovMax = sensorW > 0 && focalMin > 0
    ? Math.round(2 * Math.atan(sensorW / (2 * focalMin)) * (180 / Math.PI) * 10) / 10
    : 180
  const hFovMin = sensorW > 0 && focalMax > 0
    ? Math.round(2 * Math.atan(sensorW / (2 * focalMax)) * (180 / Math.PI) * 10) / 10
    : 5

  const hasSensor = resolutionW > 0 && sensorW > 0 && focalLength > 0
  const ppf = hasSensor ? calculatePpfAtDistance(resolutionW, sensorW, focalLength, targetDist) : 0
  const activeDori = hasSensor ? classifyDori(ppf) : 'none'

  const updateProp = (key: string, value: unknown) => {
    onUpdateDevice(device.id, { properties: { ...props, [key]: value } })
  }

  // When H-FoV changes, back-calculate focal length: fl = sensorW / (2 * tan(hFov/2))
  const handleHFovChange = (newHFov: number) => {
    if (sensorW > 0) {
      const newFocal = Math.round((sensorW / (2 * Math.tan((newHFov / 2) * Math.PI / 180))) * 100) / 100
      // Clamp to varifocal range
      const clampedFocal = Math.max(focalMin, Math.min(focalMax, newFocal))
      onUpdateDevice(device.id, { properties: { ...props, focal_length: clampedFocal, fov_angle: newHFov } })
    } else {
      updateProp('fov_angle', newHFov)
    }
  }

  // SVG diagram math
  const diagW = 280
  const diagH = 200
  const maxDist = Math.max(targetDist * 2.2, 30)
  const pxPerFt = (diagW - 40) / maxDist
  const camX = 28
  const groundY = diagH - 20
  const camY = groundY - (installHeight * pxPerFt)
  const vFov = hFov * 0.75

  // Side view cone points
  const tiltRad = (tiltAngle * Math.PI) / 180
  const halfVFovRad = (vFov * Math.PI) / 360
  const coneLen = maxDist * pxPerFt * 0.9
  const topAngle = -tiltRad - halfVFovRad
  const botAngle = -tiltRad + halfVFovRad
  const sideTopX = camX + coneLen * Math.cos(topAngle)
  const sideTopY = camY - coneLen * Math.sin(topAngle)
  const sideBotX = camX + coneLen * Math.cos(botAngle)
  const sideBotY = camY - coneLen * Math.sin(botAngle)

  // Top view cone points
  const halfHFovRad = (hFov * Math.PI) / 360
  const topCamY = diagH / 2
  const topTopX = camX + coneLen * Math.cos(-halfHFovRad)
  const topTopY = topCamY - coneLen * Math.sin(-halfHFovRad)
  const topBotX = camX + coneLen * Math.cos(halfHFovRad)
  const topBotY = topCamY - coneLen * Math.sin(halfHFovRad)

  // Person position (at target distance)
  const personX = camX + targetDist * pxPerFt
  const personSideY = groundY - 16

  // Distance markers
  const distMarkers = []
  const step = maxDist > 50 ? 10 : maxDist > 20 ? 5 : 2
  for (let d = 0; d <= maxDist; d += step) {
    distMarkers.push({ d, x: camX + d * pxPerFt })
  }

  return (
    <div style={{
      width: 680, height: '100%',
      background: C.bgSurface,
      borderLeft: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
      boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px 10px', borderBottom: `1px solid ${C.border}`,
        background: `linear-gradient(180deg, ${C.accentSubtle}, transparent)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: C.text }}>FoV</span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer',
            width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><X size={16} /></button>
        </div>
        {/* Resolution display */}
        {resolutionW > 0 && (
          <div style={{ fontSize: 12, color: C.textMuted, fontFamily: 'monospace', marginTop: 4, textAlign: 'right' }}>
            {resolutionW} × {resolutionH || Math.round(resolutionW * 9 / 16)}
          </div>
        )}
      </div>

      {/* Setting — 2×2 control grid */}
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: C.textDim, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
          Setting
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 28px' }}>
          {/* H-FoV — editable within varifocal range, back-calculates focal length */}
          <ControlRow
            label={isVarifocal ? `Horizontal FoV (${focalMin}–${focalMax}mm)` : 'Horizontal FoV'}
            value={Math.round(hFov * 10) / 10}
            unit="°"
            min={isVarifocal ? hFovMin : 1}
            max={isVarifocal ? hFovMax : 360}
            step={0.1}
            onChange={handleHFovChange}
          />
          {/* Install Height */}
          <ControlRow
            label="Installation height"
            value={installHeight}
            unit="ft"
            min={1} max={60} step={1}
            onChange={(v) => updateProp('install_height', v)}
          />
          {/* Target Distance */}
          <ControlRow
            label="Target distance"
            value={targetDist}
            unit="ft"
            min={1} max={500} step={1}
            onChange={(v) => updateProp('target_distance', v)}
          />
          {/* Tilt Angle */}
          <ControlRow
            label="Tilt angle"
            value={tiltAngle}
            unit="°"
            min={-90} max={90} step={0.5}
            onChange={(v) => updateProp('tilt_angle', v)}
          />
        </div>
      </div>

      {/* Density — DORI tiles */}
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: C.textDim, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
          Density
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {DORI_TIERS.map(tier => {
            const isActive = activeDori === tier.key
            const isMet = hasSensor && ppf >= tier.ppf
            return (
              <div key={tier.key} style={{
                flex: 1, textAlign: 'center', padding: '8px 4px', borderRadius: 8,
                border: `1px solid ${isActive ? C.accent : C.border}`,
                background: isActive ? C.accentSubtle : C.bgActive,
                transition: 'all 0.2s',
                opacity: isMet ? 1 : 0.4,
              }}>
                <DoriPreview tier={tier.key} size={36} />
                <div style={{ fontSize: 9, fontWeight: 700, color: isActive ? C.accent : C.text, marginBottom: 2 }}>
                  {tier.label}
                </div>
                <div style={{ fontSize: 8, color: C.textDim, fontFamily: 'monospace' }}>
                  {tier.ppm}PPM, {tier.ppf}PPF
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Views — side by side */}
      <div style={{ flex: 1, padding: '12px 20px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: C.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>Views</span>
          <span style={{ fontSize: 11, color: C.accent, cursor: 'pointer' }}>DORI Guide ⓘ</span>
        </div>

        {/* Distance control */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>Distance</span>
          <button onClick={() => updateProp('target_distance', Math.max(1, targetDist - 1))} style={{
            background: 'none', border: `1px solid ${C.border}`, color: C.textDim,
            width: 22, height: 22, borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
          }}>−</button>
          <div style={{ flex: 1, height: 4, background: C.bgActive, borderRadius: 2, position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(100, (targetDist / maxDist) * 100)}%`, background: C.accent, borderRadius: 2 }} />
          </div>
          <button onClick={() => updateProp('target_distance', targetDist + 1)} style={{
            background: 'none', border: `1px solid ${C.border}`, color: C.textDim,
            width: 22, height: 22, borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
          }}>+</button>
        </div>

        {/* Side-by-side diagrams */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, minHeight: 0 }}>
          {/* Side View */}
          <div style={{
            background: C.bg, borderRadius: 10, border: `1px solid ${C.border}`,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 8, left: 10, fontSize: 11, fontWeight: 700, color: C.text }}>Side view</div>
            <svg width="100%" height="100%" viewBox={`0 0 ${diagW} ${diagH}`} preserveAspectRatio="xMidYMid meet">
              {/* Ground */}
              <line x1={camX} y1={groundY} x2={diagW} y2={groundY} stroke={C.border} strokeWidth={1} />
              {/* Distance markers */}
              {distMarkers.map(m => (
                <text key={m.d} x={m.x} y={groundY + 14} fill={C.textDim} fontSize={7} fontFamily="monospace" textAnchor="middle">{m.d}ft</text>
              ))}
              {/* Height markers */}
              <text x={8} y={camY + 3} fill={C.textDim} fontSize={7} fontFamily="monospace">{installHeight}ft</text>
              <text x={8} y={groundY - 2} fill={C.textDim} fontSize={7} fontFamily="monospace">0</text>
              {/* Camera icon */}
              <rect x={camX - 8} y={camY - 5} width={16} height={10} rx={2} fill={C.textMuted} />
              <circle cx={camX} cy={camY} r={3} fill={C.textDim} />
              {/* FOV cone */}
              <polygon
                points={`${camX},${camY} ${sideTopX},${sideTopY} ${sideBotX},${sideBotY}`}
                fill={C.accent} opacity={0.2}
              />
              <polygon
                points={`${camX},${camY} ${sideTopX},${sideTopY} ${sideBotX},${sideBotY}`}
                fill="none" stroke={C.accent} strokeWidth={0.5} opacity={0.5}
              />
              {/* Person at target */}
              <g transform={`translate(${personX}, ${personSideY})`}>
                <circle cx={0} cy={-8} r={4} fill={C.bg} stroke={C.textDim} strokeWidth={1} />
                <line x1={0} y1={-4} x2={0} y2={8} stroke={C.textDim} strokeWidth={1.5} />
                <line x1={-5} y1={1} x2={5} y2={1} stroke={C.textDim} strokeWidth={1.5} />
                <line x1={0} y1={8} x2={-3} y2={16} stroke={C.textDim} strokeWidth={1.5} />
                <line x1={0} y1={8} x2={3} y2={16} stroke={C.textDim} strokeWidth={1.5} />
              </g>
              {/* VFoV label */}
              <rect x={camX + 8} y={camY - 18} width={76} height={16} rx={4} fill={C.bgPanel} stroke={C.border} />
              <text x={camX + 46} y={camY - 7} fill={C.text} fontSize={8} fontFamily="sans-serif" textAnchor="middle" fontWeight={600}>
                Vertical FoV {Math.round(vFov * 10) / 10}°
              </text>
            </svg>
          </div>

          {/* Top View */}
          <div style={{
            background: C.bg, borderRadius: 10, border: `1px solid ${C.border}`,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 8, left: 10, fontSize: 11, fontWeight: 700, color: C.text }}>Top view</div>
            <svg width="100%" height="100%" viewBox={`0 0 ${diagW} ${diagH}`} preserveAspectRatio="xMidYMid meet">
              {/* Distance markers */}
              <line x1={camX} y1={diagH - 20} x2={diagW} y2={diagH - 20} stroke={C.border} strokeWidth={1} />
              {distMarkers.map(m => (
                <text key={m.d} x={m.x} y={diagH - 8} fill={C.textDim} fontSize={7} fontFamily="monospace" textAnchor="middle">{m.d}ft</text>
              ))}
              {/* Camera */}
              <rect x={camX - 8} y={topCamY - 5} width={16} height={10} rx={2} fill={C.textMuted} />
              <circle cx={camX} cy={topCamY} r={3} fill={C.textDim} />
              {/* FOV cone */}
              <polygon
                points={`${camX},${topCamY} ${topTopX},${topTopY} ${topBotX},${topBotY}`}
                fill={C.accent} opacity={0.2}
              />
              <polygon
                points={`${camX},${topCamY} ${topTopX},${topTopY} ${topBotX},${topBotY}`}
                fill="none" stroke={C.accent} strokeWidth={0.5} opacity={0.5}
              />
              {/* Person at target (top-down) */}
              <circle cx={personX} cy={topCamY} r={4} fill={C.bg} stroke={C.textDim} strokeWidth={1} />
              {/* HFoV label */}
              <rect x={camX + 40} y={28} width={86} height={16} rx={4} fill={C.bgPanel} stroke={C.border} />
              <text x={camX + 83} y={39} fill={C.text} fontSize={8} fontFamily="sans-serif" textAnchor="middle" fontWeight={600}>
                Horizontal FoV {Math.round(hFov)}°
              </text>
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── DORI Preview — CSS face + plate with progressive pixelation ─── */
const BLUR_MAP: Record<string, number> = {
  identification: 0,
  recognition: 1,
  observation: 2.5,
  detection: 4,
  monitor: 7,
}
function DoriPreview({ tier, size }: { tier: string; size: number }) {
  const blur = BLUR_MAP[tier] ?? 4
  return (
    <div style={{
      width: size, height: size + 14, margin: '0 auto 4px',
      display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center',
    }}>
      {/* Face — SVG with CSS blur */}
      <div style={{
        width: size, height: size * 0.7, borderRadius: 4, background: C.bgHover,
        overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
        filter: `blur(${blur}px)`,
      }}>
        <svg width={size * 0.7} height={size * 0.6} viewBox="0 0 24 22">
          {/* Head */}
          <ellipse cx={12} cy={8} rx={7} ry={8} fill="#c9a37b" />
          {/* Hair */}
          <ellipse cx={12} cy={5} rx={7.5} ry={5} fill="#4a3728" />
          {/* Eyes */}
          <ellipse cx={9} cy={9} rx={1.2} ry={0.9} fill="#2c1810" />
          <ellipse cx={15} cy={9} rx={1.2} ry={0.9} fill="#2c1810" />
          {/* Nose */}
          <ellipse cx={12} cy={11.5} rx={0.8} ry={0.5} fill="#b8926a" />
          {/* Mouth */}
          <path d="M10 13.5 Q12 15 14 13.5" fill="none" stroke="#8b6650" strokeWidth={0.7} />
          {/* Shoulders */}
          <path d="M3 22 Q6 16 12 16 Q18 16 21 22" fill="#4a6fa5" />
        </svg>
      </div>
      {/* Plate */}
      <div style={{
        fontSize: 6, fontWeight: 700, fontFamily: 'monospace',
        background: '#f0f0f0', color: '#1a1a1a', padding: '1px 3px',
        borderRadius: 2, border: '0.5px solid #999', letterSpacing: 0.5,
        filter: `blur(${blur * 0.7}px)`,
        lineHeight: 1.2,
      }}>
        ABC 1234
      </div>
    </div>
  )
}

/* ─── Control Row (label + FUNCTIONAL slider + input + spinner + unit) ─── */
function ControlRow({ label, value, unit, min, max, step, readOnly, onChange }: {
  label: string; value: number; unit: string; min: number; max: number; step: number
  readOnly?: boolean; onChange: (v: number) => void
}) {
  const barRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const pct = ((value - min) / (max - min)) * 100

  const valueFromMouseX = useCallback((clientX: number) => {
    const bar = barRef.current
    if (!bar) return value
    const rect = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const raw = min + ratio * (max - min)
    // Snap to step
    return Math.round(raw / step) * step
  }, [min, max, step, value])

  const handleBarMouseDown = useCallback((e: React.MouseEvent) => {
    if (readOnly) return
    e.preventDefault()
    dragging.current = true
    const newVal = valueFromMouseX(e.clientX)
    onChange(Math.max(min, Math.min(max, newVal)))

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      const v = valueFromMouseX(ev.clientX)
      onChange(Math.max(min, Math.min(max, v)))
    }
    const onUp = () => {
      dragging.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [readOnly, valueFromMouseX, onChange, min, max])

  return (
    <div>
      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Bar — functional drag slider */}
        <div
          ref={barRef}
          onMouseDown={handleBarMouseDown}
          style={{
            flex: 1, height: 6, background: C.bgActive, borderRadius: 3,
            position: 'relative', cursor: readOnly ? 'default' : 'pointer',
          }}
        >
          <div style={{
            position: 'absolute', left: 0, top: 0, height: '100%',
            width: `${Math.min(100, Math.max(0, pct))}%`,
            background: C.accent, borderRadius: 3,
          }} />
          <div style={{
            position: 'absolute', top: '50%',
            left: `${Math.min(100, Math.max(0, pct))}%`,
            transform: 'translate(-50%,-50%)',
            width: 16, height: 16, borderRadius: '50%',
            background: C.accent, border: '3px solid var(--canvas-text)',
            cursor: readOnly ? 'default' : 'grab',
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            transition: dragging.current ? 'none' : 'left 0.1s',
          }} />
        </div>
        {/* Input */}
        <input
          type="number" value={value} min={min} max={max} step={step}
          readOnly={readOnly}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            width: 60, padding: '5px 8px', background: C.bgPanel,
            border: `1px solid ${C.border}`, borderRadius: 6,
            color: C.text, fontSize: 13, fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace",
            textAlign: 'right', outline: 'none', fontWeight: 600,
            opacity: readOnly ? 0.6 : 1,
          }}
        />
        {/* Spinners */}
        {!readOnly && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <button onClick={() => onChange(Math.min(max, value + step))} style={{
              background: 'none', border: `1px solid ${C.border}`, color: C.textDim,
              width: 18, height: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 8, borderRadius: '3px 3px 0 0',
            }}>▲</button>
            <button onClick={() => onChange(Math.max(min, value - step))} style={{
              background: 'none', border: `1px solid ${C.border}`, borderTop: 'none', color: C.textDim,
              width: 18, height: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 8, borderRadius: '0 0 3px 3px',
            }}>▼</button>
          </div>
        )}
        <span style={{ fontSize: 11, color: C.textDim, width: 20 }}>{unit}</span>
      </div>
    </div>
  )
}
