'use client'
/**
 * RightPanel — Device properties panel (Hanwha DesignPro style).
 *
 * Layout matches Hanwha exactly:
 *   Camera image + model name
 *   Focal length: slider + input
 *   Target distance: slider + input
 *   Installation height: slider + input
 *   Tilt angle: slider + input
 *   Camera rotation: slider + input
 *   FOV angle: slider + input
 *   Notes
 *   Actions (Duplicate / Delete)
 */

import React, { useState, useCallback, useEffect } from 'react'
import { X, Copy, Trash2, Cable } from 'lucide-react'
import { C } from './constants'
import type { DesignDevice, DesignMdfIdf } from '@/types/database'

/* ─── Props ─── */
interface Props {
  device: DesignDevice
  onClose: () => void
  onUpdateDevice: (id: string, updates: Record<string, unknown>) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  scalePxPerFt: number
  onChangeModel?: (id: string) => void
  mdfIdfs?: DesignMdfIdf[]
}

/* ─── Slider+Input Combo (Hanwha pattern) ─── */
function ParamRow({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string
  onChange: (v: number) => void
}) {
  const [local, setLocal] = useState(value)
  useEffect(() => { setLocal(value) }, [value])

  const commit = (v: number) => {
    const clamped = Math.max(min, Math.min(max, v))
    setLocal(clamped)
    onChange(clamped)
  }

  return (
    <div style={{ padding: '8px 16px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 6 }}>{label}</div>
      <input type="range" min={min} max={max} step={step} value={local}
        onChange={e => setLocal(Number(e.target.value))}
        onMouseUp={() => commit(local)}
        onTouchEnd={() => commit(local)}
        style={{
          width: '100%', height: 4, appearance: 'none', background: C.bgActive,
          borderRadius: 2, outline: 'none', cursor: 'pointer',
          accentColor: C.accent,
        }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 6 }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 6,
          overflow: 'hidden',
        }}>
          <button onClick={() => commit(local - step)}
            style={{ width: 28, height: 28, background: 'transparent', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>−</button>
          <input type="number" value={local} step={step} min={min} max={max}
            onChange={e => setLocal(Number(e.target.value))}
            onBlur={() => commit(local)}
            onKeyDown={e => { if (e.key === 'Enter') commit(local) }}
            style={{
              width: 60, textAlign: 'center', background: 'transparent',
              border: 'none', borderLeft: `1px solid ${C.border}`,
              borderRight: `1px solid ${C.border}`,
              color: C.text, fontFamily: "monospace",
              outline: 'none', padding: '4px 0',
            }} />
          <span style={{ padding: '0 6px', fontSize: 10, color: C.textDim, minWidth: 20 }}>{unit}</span>
          <button onClick={() => commit(local + step)}
            style={{ width: 28, height: 28, background: 'transparent', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>+</button>
        </div>
      </div>
    </div>
  )
}

/* ─── Elevation View SVG (side-profile) ─── */
function ElevationDiagram({ installHeight, tiltAngle, targetDist, fovAngle }: {
  installHeight: number; tiltAngle: number; targetDist: number; fovAngle: number
}) {
  const W = 248, H = 140
  const PAD_L = 30, PAD_R = 14, PAD_T = 14, PAD_B = 22
  const drawW = W - PAD_L - PAD_R
  const drawH = H - PAD_T - PAD_B

  // Scale to fit: max of installHeight and targetDist
  const personH = 5.5 // ft
  const maxVert = Math.max(installHeight, personH) * 1.15
  const maxHoriz = Math.max(targetDist, 5) * 1.1
  const scaleX = drawW / maxHoriz
  const scaleY = drawH / maxVert

  const groundY = PAD_T + drawH
  const camX = PAD_L
  const camY = groundY - installHeight * scaleY

  // Target point
  const targetX = PAD_L + targetDist * scaleX
  const targetY = groundY

  // FOV cone from side view (using vertical FOV ≈ fovAngle * 0.75)
  const vFovHalf = (fovAngle * 0.75 / 2) * Math.PI / 180
  const tiltRad = tiltAngle * Math.PI / 180
  const coneLen = targetDist * scaleX

  // Upper and lower edges of FOV cone
  const upperAngle = tiltRad - vFovHalf
  const lowerAngle = tiltRad + vFovHalf
  const cone1X = camX + Math.cos(upperAngle) * coneLen
  const cone1Y = camY + Math.sin(upperAngle) * coneLen
  const cone2X = camX + Math.cos(lowerAngle) * coneLen
  const cone2Y = camY + Math.sin(lowerAngle) * coneLen

  // Person silhouette at target
  const personTop = groundY - personH * scaleY

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', borderRadius: 4, background: C.bgActive }}>
      {/* Grid lines */}
      <line x1={PAD_L} y1={groundY} x2={W - PAD_R} y2={groundY} stroke={C.border} strokeWidth={1.5} />
      <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={groundY} stroke={C.border} strokeWidth={0.5} strokeDasharray="3,3" />

      {/* FOV cone (translucent triangle) */}
      <polygon
        points={`${camX},${camY} ${cone1X},${Math.min(cone1Y, groundY)} ${cone2X},${Math.min(cone2Y, groundY)}`}
        fill={C.accent} opacity={0.12} stroke={C.accent} strokeWidth={0.5} strokeOpacity={0.4}
      />

      {/* Cone center line (dashed) */}
      <line x1={camX} y1={camY} x2={targetX} y2={groundY}
        stroke={C.accent} strokeWidth={0.5} strokeDasharray="4,3" opacity={0.5} />

      {/* Camera icon (small rect + triangle) */}
      <rect x={camX - 6} y={camY - 4} width={12} height={8} rx={1.5}
        fill={C.accent} stroke="none" />
      <polygon points={`${camX + 6},${camY - 2} ${camX + 10},${camY} ${camX + 6},${camY + 2}`}
        fill={C.accent} />

      {/* Person silhouette at target distance */}
      <line x1={targetX} y1={groundY} x2={targetX} y2={personTop}
        stroke="#22c55e" strokeWidth={1.5} strokeLinecap="round" />
      <circle cx={targetX} cy={personTop - 3} r={3} fill="#22c55e" />

      {/* Height dimension line (left side) */}
      <line x1={PAD_L - 8} y1={groundY} x2={PAD_L - 8} y2={camY}
        stroke={C.textDim} strokeWidth={0.5} markerStart="url(#arrowUp)" markerEnd="url(#arrowDown)" />
      <text x={2} y={(groundY + camY) / 2 + 3} fontSize={7} fill={C.textMuted}
        fontFamily="'IBM Plex Mono', monospace" textAnchor="start">
        {installHeight}ft
      </text>

      {/* Distance label (bottom) */}
      <line x1={camX} y1={groundY + 10} x2={targetX} y2={groundY + 10}
        stroke={C.textDim} strokeWidth={0.5} />
      <text x={(camX + targetX) / 2} y={groundY + 18} fontSize={7} fill={C.textMuted}
        fontFamily="'IBM Plex Mono', monospace" textAnchor="middle">
        {targetDist}ft
      </text>

      {/* Person height label */}
      <text x={targetX + 8} y={(groundY + personTop) / 2 + 3} fontSize={6.5} fill="#22c55e"
        fontFamily="'IBM Plex Mono', monospace">
        {personH}ft
      </text>

      {/* Tilt label */}
      {tiltAngle !== 0 && (
        <text x={camX + 16} y={camY - 8} fontSize={7} fill={C.accent}
          fontFamily="'IBM Plex Mono', monospace">
          {tiltAngle}°
        </text>
      )}
    </svg>
  )
}

/* ─── Component ─── */
export function RightPanel({ device, onClose, onUpdateDevice, onDuplicate, onDelete, scalePxPerFt, mdfIdfs }: Props) {
  const props = (device.properties ?? {}) as Record<string, unknown>
  const isCamera = ['cctv', 'dome', 'bullet', 'turret', 'ptz', 'fisheye', 'multisensor_quad', 'multisensor_dual'].includes(device.category)

  const updateProp = useCallback((key: string, value: unknown) => {
    onUpdateDevice(device.id, { properties: { ...props, [key]: value } })
  }, [device.id, props, onUpdateDevice])

  const focalLength = Number(props.focal_length) || 4
  const targetDist = Number(props.target_distance) || 30
  const installHeight = Number(props.install_height) || 9
  const tiltAngle = Number(props.tilt_angle) || 0
  const fovAngle = Number(props.fov_angle) || 90
  const rotation = device.rotation || 0

  return (
    <div style={{
      width: 280, height: '100%', background: C.bgPanel,
      borderLeft: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Inter', 'Segoe UI', sans-serif", overflow: 'hidden',
    }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
            {device.label || 'Device'}
          </div>
          <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>
            {device.category.replace(/_/g, ' ').toUpperCase()}
            {props.resolution_w ? ` • ${props.resolution_w}×${props.resolution_h || '?'}` : ''}
          </div>
        </div>
        <button onClick={onClose}
          style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', padding: 4 }}>
          <X size={16} />
        </button>
      </div>

      {/* ── Properties ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Label */}
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 6 }}>Label</div>
          <input value={device.label || ''} placeholder="Device label"
            onChange={e => onUpdateDevice(device.id, { label: e.target.value })}
            style={{
              width: '100%', padding: '6px 10px', background: C.bgActive,
              border: `1px solid ${C.border}`, borderRadius: 4,
              color: C.text, fontSize: 12, fontFamily: 'inherit', outline: 'none',
            }} />
        </div>

        {/* Camera-specific sliders */}
        {isCamera && (
          <>
            <div style={{ borderBottom: `1px solid ${C.borderSubtle}` }}>
              <ParamRow label="Focal Length" value={focalLength}
                min={1} max={300} step={0.5} unit="mm"
                onChange={v => updateProp('focal_length', v)} />
            </div>

            <div style={{ borderBottom: `1px solid ${C.borderSubtle}` }}>
              <ParamRow label="Target Distance" value={targetDist}
                min={1} max={500} step={1} unit="ft"
                onChange={v => updateProp('target_distance', v)} />
            </div>

            <div style={{ borderBottom: `1px solid ${C.borderSubtle}` }}>
              <ParamRow label="Installation Height" value={installHeight}
                min={1} max={60} step={0.5} unit="ft"
                onChange={v => updateProp('install_height', v)} />
            </div>

            <div style={{ borderBottom: `1px solid ${C.borderSubtle}` }}>
              <ParamRow label="Tilt Angle" value={tiltAngle}
                min={-90} max={90} step={1} unit="°"
                onChange={v => updateProp('tilt_angle', v)} />
            </div>

            <div style={{ borderBottom: `1px solid ${C.borderSubtle}` }}>
              <ParamRow label="FOV Angle" value={fovAngle}
                min={5} max={180} step={1} unit="°"
                onChange={v => updateProp('fov_angle', v)} />
            </div>

            <div style={{ borderBottom: `1px solid ${C.borderSubtle}` }}>
              <ParamRow label="Camera Rotation" value={rotation}
                min={0} max={360} step={1} unit="°"
                onChange={v => onUpdateDevice(device.id, { rotation: v })} />
            </div>

            {/* DORI at target distance */}
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 8 }}>Quality at Target</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                {['Detection', 'Observation', 'Recognition', 'Identification'].map((tier, i) => {
                  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e']
                  return (
                    <div key={tier} style={{
                      padding: '6px 4px', textAlign: 'center', borderRadius: 4,
                      background: `${colors[i]}15`, border: `1px solid ${colors[i]}30`,
                      fontSize: 8, fontWeight: 600, color: colors[i], lineHeight: 1.2,
                    }}>
                      {tier[0]}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Elevation View (side-profile SVG) ── */}
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 8 }}>Elevation View</div>
              <ElevationDiagram
                installHeight={installHeight}
                tiltAngle={tiltAngle}
                targetDist={targetDist}
                fovAngle={fovAngle}
              />
            </div>
          </>
        )}

        {/* Notes */}
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 6 }}>Notes</div>
          <textarea
            value={String(props.notes || '')}
            placeholder="Add notes..."
            onChange={e => updateProp('notes', e.target.value)}
            style={{
              width: '100%', minHeight: 60, padding: '6px 10px', background: C.bgActive,
              border: `1px solid ${C.border}`, borderRadius: 4,
              color: C.text, fontSize: 11, fontFamily: 'inherit',
              resize: 'vertical', outline: 'none',
            }}
          />
        </div>

        {/* Position + Auto Cable Distance */}
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 6 }}>Position</div>
           <div style={{ display: 'flex', gap: 8, fontSize: 11, color: C.textMuted, fontFamily: 'monospace' }}>
            <span>X: {device.position_x}</span>
            <span>Y: {device.position_y}</span>
          </div>

          {/* Auto cable distance to nearest MDF/IDF */}
          {mdfIdfs && mdfIdfs.length > 0 && (() => {
            let nearest = Infinity
            let nearestName = ''
            for (const node of mdfIdfs) {
              const dx = device.position_x - node.position_x
              const dy = device.position_y - node.position_y
              const distPx = Math.sqrt(dx * dx + dy * dy)
              const distFt = distPx / (scalePxPerFt || 10)
              if (distFt < nearest) { nearest = distFt; nearestName = node.name || 'MDF/IDF' }
            }
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '6px 8px', background: C.bgActive, borderRadius: 4, border: `1px solid ${C.border}` }}>
                <Cable size={12} style={{ color: C.accent, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: C.textDim }}>Est. cable to {nearestName}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.text, fontFamily: 'monospace' }}>
                    {Math.round(nearest)} ft
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* ── Actions Footer ── */}
      <div style={{
        display: 'flex', gap: 8, padding: '12px 16px',
        borderTop: `1px solid ${C.border}`,
      }}>
        <button onClick={() => onDuplicate(device.id)}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            padding: '8px 0', background: C.bgActive, border: `1px solid ${C.border}`,
            borderRadius: 6, color: C.text, fontSize: 11, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
          <Copy size={12} /> Duplicate
        </button>
        <button onClick={() => onDelete(device.id)}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            padding: '8px 0', background: '#ef444415', border: `1px solid #ef444440`,
            borderRadius: 6, color: C.red, fontSize: 11, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
          <Trash2 size={12} /> Delete
        </button>
      </div>
    </div>
  )
}
