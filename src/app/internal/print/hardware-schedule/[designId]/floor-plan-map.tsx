'use client'

import { useEffect, useRef, useState } from 'react'

interface DeviceLite {
  id: string
  label: string
  category: string
  status: string
  position_x: number
  position_y: number
  rotation: number
  cableRunFt: number | null
  mdfName: string | null
}

interface Wall {
  id: string
  points: Array<{ x: number; y: number }>
  color: string
}

interface Mdf {
  id: string
  name: string
  position_x: number
  position_y: number
}

export interface FloorPlanMapProps {
  areaId: string
  floorPlanUrl: string | null
  devices: DeviceLite[]
  mdfs: Mdf[]
  walls: Wall[]
}

declare global {
  interface Window { __siteMapsReady?: Record<string, boolean> }
}

function markReady(id: string) {
  if (typeof window === 'undefined') return
  window.__siteMapsReady = window.__siteMapsReady || {}
  window.__siteMapsReady[id] = true
}

export function FloorPlanMap({ areaId, floorPlanUrl, devices, mdfs, walls }: FloorPlanMapProps) {
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)
  const [failed, setFailed] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (!floorPlanUrl) { markReady(areaId); setFailed(true); return }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { setDims({ w: img.naturalWidth, h: img.naturalHeight }); markReady(areaId) }
    img.onerror = () => { setFailed(true); markReady(areaId) }
    img.src = floorPlanUrl
  }, [areaId, floorPlanUrl])

  if (failed || !floorPlanUrl) {
    return <div style={{ width: '100%', height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', color: '#6b7280', fontSize: 12, border: '1px solid #e5e7eb' }}>No satellite coordinates or floor plan available for this area.</div>
  }
  if (!dims) {
    return <div style={{ width: '100%', height: 400, background: '#f9fafb', border: '1px solid #e5e7eb' }} />
  }

  const maxW = 700
  const scale = Math.min(1, maxW / dims.w)
  const W = dims.w * scale
  const H = dims.h * scale

  return (
    <div style={{ position: 'relative', width: W, height: H, border: '1px solid #e5e7eb', background: '#fff' }}>
      <img ref={imgRef} src={floorPlanUrl} alt="" width={W} height={H} style={{ display: 'block' }} />
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {walls.map(w => {
          if (w.points.length < 2) return null
          const d = w.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x * scale},${p.y * scale}`).join(' ')
          return <path key={w.id} d={d} stroke={w.color || '#f97316'} strokeWidth={3} fill="none" />
        })}
        {devices.map(d => {
          const x = d.position_x * scale
          const y = d.position_y * scale
          const color = d.status === 'relocate' ? '#f97316' : d.category.startsWith('camera') ? '#3b82f6' : '#8b5cf6'
          return (
            <g key={d.id}>
              <circle cx={x} cy={y} r={7} fill={color} stroke="#fff" strokeWidth={2} />
              <text x={x + 10} y={y + 4} fontSize={9} fill="#111" fontWeight={700}>
                {d.label}{d.cableRunFt ? ` · ${Math.round(d.cableRunFt)}ft` : ''}{d.mdfName ? ` → ${d.mdfName}` : ''}
              </text>
            </g>
          )
        })}
        {mdfs.map(m => {
          const x = m.position_x * scale
          const y = m.position_y * scale
          return (
            <g key={m.id}>
              <circle cx={x} cy={y} r={9} fill="#111827" stroke="#fff" strokeWidth={2} />
              <text x={x + 12} y={y + 4} fontSize={10} fill="#111" fontWeight={700}>{m.name}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
