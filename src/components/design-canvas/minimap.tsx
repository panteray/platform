import { C } from './constants'

const MAP_W = 160
const MAP_H = 120
const PAD = 6

export interface MinimapViewport {
  worldX: number
  worldY: number
  worldW: number
  worldH: number
}

export interface MinimapDevice {
  id: string
  x: number
  y: number
  color: string
}

export interface MinimapZone {
  id: string
  x: number
  y: number
  w: number
  h: number
  color: string
}

export interface MinimapInfra {
  id: string
  x: number
  y: number
}

interface MinimapProps {
  devices: MinimapDevice[]
  zones: MinimapZone[]
  infra: MinimapInfra[]
  viewport: MinimapViewport
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
  onNavigate: (worldX: number, worldY: number) => void
}

export function Minimap({ devices, zones, infra, viewport, bounds, onNavigate }: MinimapProps) {
  const bw = bounds.maxX - bounds.minX
  const bh = bounds.maxY - bounds.minY
  if (bw <= 0 || bh <= 0) return null

  // Scale to fit the minimap with padding
  const innerW = MAP_W - PAD * 2
  const innerH = MAP_H - PAD * 2
  const scale = Math.min(innerW / bw, innerH / bh)
  const offX = PAD + (innerW - bw * scale) / 2
  const offY = PAD + (innerH - bh * scale) / 2

  function toMini(wx: number, wy: number) {
    return { x: offX + (wx - bounds.minX) * scale, y: offY + (wy - bounds.minY) * scale }
  }

  // Viewport rect in minimap coords
  const vp = toMini(viewport.worldX, viewport.worldY)
  const vpW = viewport.worldW * scale
  const vpH = viewport.worldH * scale

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    // Convert minimap coords back to world
    const wx = bounds.minX + (mx - offX) / scale
    const wy = bounds.minY + (my - offY) / scale
    onNavigate(wx, wy)
  }

  return (
    <div style={{
      position: 'absolute', bottom: 40, left: 12, zIndex: 15,
      width: MAP_W, height: MAP_H,
      background: 'rgba(15,17,23,0.88)', border: `1px solid ${C.border}`,
      borderRadius: 6, overflow: 'hidden', cursor: 'pointer',
      boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
    }}>
      <svg width={MAP_W} height={MAP_H} onClick={handleClick}>
        {/* Zones */}
        {zones.map((z) => {
          const p = toMini(z.x, z.y)
          return (
            <rect key={z.id} x={p.x} y={p.y}
              width={Math.max(2, z.w * scale)} height={Math.max(2, z.h * scale)}
              fill={z.color} opacity={0.2} stroke={z.color} strokeWidth={0.5} strokeOpacity={0.4} />
          )
        })}

        {/* Devices */}
        {devices.map((d) => {
          const p = toMini(d.x, d.y)
          return <circle key={d.id} cx={p.x} cy={p.y} r={2.5} fill={d.color} opacity={0.85} />
        })}

        {/* MDF/IDF */}
        {infra.map((n) => {
          const p = toMini(n.x, n.y)
          return (
            <polygon key={n.id}
              points={`${p.x},${p.y - 3.5} ${p.x + 3.5},${p.y} ${p.x},${p.y + 3.5} ${p.x - 3.5},${p.y}`}
              fill={C.orange} opacity={0.9} />
          )
        })}

        {/* Viewport rectangle */}
        <rect x={vp.x} y={vp.y} width={vpW} height={vpH}
          fill="none" stroke="#fff" strokeWidth={1} strokeDasharray="3 2" strokeOpacity={0.7} />
      </svg>
    </div>
  )
}
