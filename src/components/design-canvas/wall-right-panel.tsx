'use client'

import React from 'react'
import { X, Trash2, Minus } from 'lucide-react'
import { C } from './constants'

/* ── Types ── */
export interface WallData {
  id: string
  name?: string
  points: Array<{ x: number; y: number }>
  wallType?: string
  heightFt?: number
  opacity?: number
  color?: string
}

interface Props {
  wall: WallData
  onClose: () => void
  onUpdateWall: (id: string, updates: Partial<WallData>) => void
  onDelete: (id: string) => void
  scalePxPerFt?: number
}

/* ── Constants ── */
const WALL_TYPES = ['Solid', 'Glass', 'Partial', 'Fence', 'Curtain']
const WALL_COLORS = ['#334155', '#64748b', '#0ea5e9', '#22c55e', '#f97316', '#ef4444', '#a855f7', '#ec4899']

/* ── Component ── */
export function WallRightPanel({ wall, onClose, onUpdateWall, onDelete, scalePxPerFt }: Props) {
  const wallType = wall.wallType || 'Solid'
  const heightFt = wall.heightFt ?? 10
  const wallOpacity = wall.opacity ?? 1
  const wallColor = wall.color || '#334155'
  const wallName = wall.name || 'Wall'

  const totalLength = wall.points.reduce((sum, p, i) => {
    if (i === 0) return 0
    const prev = wall.points[i - 1]
    return sum + Math.sqrt((p.x - prev.x) ** 2 + (p.y - prev.y) ** 2)
  }, 0)

  const fmtLen = (px: number) =>
    scalePxPerFt && scalePxPerFt > 0 ? `${Math.round(px / scalePxPerFt)} ft` : `${Math.round(px)}px`

  /** Remove a segment by removing the endpoint vertex. Minimum 2 points to keep a wall. */
  const removeSegment = (segIdx: number) => {
    if (wall.points.length <= 2) return // can't remove — would destroy the wall
    // Remove the end vertex of this segment (segIdx + 1)
    const newPts = wall.points.filter((_, i) => i !== segIdx + 1)
    onUpdateWall(wall.id, { points: newPts })
  }

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
        <div style={{
          width: 6, height: 24, borderRadius: 3, background: wallColor,
        }} />
        <div style={{ flex: 1 }}>
          {/* Editable wall name */}
          <input
            value={wallName}
            onChange={e => onUpdateWall(wall.id, { name: e.target.value })}
            style={{
              fontSize: 13, fontWeight: 700, color: C.text, background: 'transparent',
              border: 'none', borderBottom: `1px solid ${C.borderSubtle}`,
              padding: '0 0 2px', outline: 'none', fontFamily: 'inherit', width: '100%',
            }}
          />
          <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>
            {wall.points.length} vertices · {wall.points.length - 1} segments · {fmtLen(totalLength)}
          </div>
        </div>
        <button onClick={onClose}
          style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', padding: 4 }}>
          <X size={16} />
        </button>
      </div>

      {/* ── Properties ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Wall Type */}
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 6 }}>Wall Type</div>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {WALL_TYPES.map(t => {
              const active = wallType === t
              return (
                <button key={t} onClick={() => onUpdateWall(wall.id, { wallType: t })}
                  style={{
                    padding: '4px 8px', fontSize: 9, fontWeight: 600,
                    borderRadius: 3, border: `1px solid ${active ? C.accent : C.border}`,
                    background: active ? `${C.accent}20` : 'transparent',
                    color: active ? C.accent : C.textMuted, cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}>{t}</button>
              )
            })}
          </div>
          {wallType === 'Glass' && (
            <div style={{
              marginTop: 6, padding: '4px 8px', borderRadius: 4,
              background: '#0ea5e915', border: '1px solid #0ea5e930',
              fontSize: 9, color: '#0ea5e9',
            }}>
              Glass walls allow FOV pass-through (no clipping)
            </div>
          )}
        </div>

        {/* Wall Height */}
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.text }}>Wall Height</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <input type="number" value={heightFt} min={1} max={40} step={0.5}
                onChange={e => onUpdateWall(wall.id, { heightFt: Number(e.target.value) })}
                style={{
                  width: 48, padding: '3px 6px', background: C.bgActive,
                  border: `1px solid ${C.border}`, borderRadius: 3,
                  color: C.text, fontSize: 10, fontFamily: 'monospace', outline: 'none', textAlign: 'right',
                }} />
              <span style={{ fontSize: 9, color: C.textDim }}>ft</span>
            </div>
          </div>
          <input type="range" value={heightFt} min={1} max={40} step={0.5}
            onChange={e => onUpdateWall(wall.id, { heightFt: Number(e.target.value) })}
            style={{ width: '100%', accentColor: C.accent }} />
        </div>

        {/* Wall Color */}
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 6 }}>Color</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {WALL_COLORS.map(c => (
              <button key={c} onClick={() => onUpdateWall(wall.id, { color: c })}
                style={{
                  width: 20, height: 20, borderRadius: 4, background: c,
                  border: 'none', cursor: 'pointer',
                  outline: wallColor === c ? '2px solid #fff' : 'none', outlineOffset: 1,
                }} />
            ))}
          </div>
        </div>

        {/* Wall Opacity */}
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.text }}>Opacity</div>
            <span style={{ fontSize: 10, color: C.textDim, fontFamily: 'monospace' }}>{Math.round(wallOpacity * 100)}%</span>
          </div>
          <input type="range" value={wallOpacity} min={0.1} max={1} step={0.05}
            onChange={e => onUpdateWall(wall.id, { opacity: Number(e.target.value) })}
            style={{ width: '100%', accentColor: C.accent }} />
        </div>

        {/* Segments — editable, removable */}
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 6 }}>
            Segments ({wall.points.length - 1})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {wall.points.slice(1).map((p, i) => {
              const prev = wall.points[i]
              const len = Math.sqrt((p.x - prev.x) ** 2 + (p.y - prev.y) ** 2)
              const canRemove = wall.points.length > 2
              return (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '5px 8px', background: C.bgActive, borderRadius: 4,
                  border: `1px solid ${C.border}`,
                }}>
                  <span style={{ fontSize: 9, color: C.textDim }}>Seg {i + 1}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, color: C.text, fontWeight: 600, fontFamily: 'monospace' }}>
                      {fmtLen(len)}
                    </span>
                    {canRemove && (
                      <button onClick={() => removeSegment(i)} title="Remove this segment"
                        style={{
                          background: 'none', border: 'none', color: '#ef4444',
                          cursor: 'pointer', padding: 1, opacity: 0.4,
                        }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}>
                        <Minus size={10} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ fontSize: 8, color: C.textDim, marginTop: 4 }}>
            Click wall on canvas to add vertices · Right-click vertex to remove
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}` }}>
        <button
          onClick={() => { onDelete(wall.id); onClose() }}
          style={{
            width: '100%', padding: '8px 0', background: '#ef444420', border: '1px solid #ef444440',
            borderRadius: 6, color: '#ef4444', fontSize: 11, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
          <Trash2 size={13} />
          Delete Wall
        </button>
      </div>
    </div>
  )
}
