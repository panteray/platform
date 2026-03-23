'use client'
/**
 * LeftPanel — Device inventory list (Hanwha DesignPro style).
 *
 * Shows all devices placed in the current area with category icons,
 * labels, and quick-select. Click a row to select on canvas.
 */

import React from 'react'
import { Plus, Trash2, Cctv, DoorOpen, Network, Speaker, Cpu, Box, Locate } from 'lucide-react'
import { C } from './constants'
import type { DesignDevice } from '@/types/database'

const CAT_ICON: Record<string, React.ReactNode> = {
  cctv: <Cctv size={14} />, dome: <Cctv size={14} />, bullet: <Cctv size={14} />,
  turret: <Cctv size={14} />, ptz: <Cctv size={14} />, fisheye: <Cctv size={14} />,
  access_control: <DoorOpen size={14} />, network: <Network size={14} />,
  av: <Speaker size={14} />, vape_environmental: <Cpu size={14} />,
}
const CAT_COLOR: Record<string, string> = {
  cctv: '#3b82f6', dome: '#3b82f6', bullet: '#3b82f6', turret: '#3b82f6',
  ptz: '#8b5cf6', fisheye: '#06b6d4', access_control: '#f97316',
  network: '#22c55e', av: '#eab308', vape_environmental: '#ef4444',
}

interface Props {
  devices: DesignDevice[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onAddDevice: () => void
  onDeleteDevice: (id: string) => void
  onZoomToDevice?: (id: string) => void
}

export function LeftPanel({ devices, selectedId, onSelect, onAddDevice, onDeleteDevice, onZoomToDevice }: Props) {
  // Group devices by category
  const groups = React.useMemo(() => {
    const map = new Map<string, DesignDevice[]>()
    for (const d of devices) {
      const cat = d.category
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(d)
    }
    return map
  }, [devices])

  return (
    <div style={{
      width: 220, background: C.bgPanel, borderRight: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column', flexShrink: 0,
      fontFamily: "'Inter', 'Segoe UI', sans-serif", overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px', borderBottom: `1px solid ${C.border}`,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
          Devices ({devices.length})
        </span>
        <button onClick={onAddDevice}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 8px', background: C.accent, color: '#fff',
            border: 'none', borderRadius: 4, fontSize: 10, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
          <Plus size={12} /> Add
        </button>
      </div>

      {/* Device list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {devices.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center', color: C.textDim, fontSize: 11 }}>
            No devices placed yet.<br />
            Click "Add" to browse the catalog.
          </div>
        )}

        {Array.from(groups.entries()).map(([cat, devs]) => (
          <div key={cat}>
            {/* Category header */}
            <div style={{
              padding: '6px 12px', fontSize: 9, fontWeight: 700,
              color: CAT_COLOR[cat] || C.textMuted,
              textTransform: 'uppercase', letterSpacing: '0.5px',
            }}>
              {cat.replace(/_/g, ' ')} ({devs.length})
            </div>

            {/* Device rows */}
            {devs.map(d => {
              const sel = d.id === selectedId
              return (
                <div key={d.id}
                  onClick={() => onSelect(d.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 12px', cursor: 'pointer',
                    background: sel ? C.accentSubtle : 'transparent',
                    borderLeft: sel ? `2px solid ${C.accent}` : '2px solid transparent',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!sel) e.currentTarget.style.background = C.bgHover }}
                  onMouseLeave={e => { if (!sel) e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ color: CAT_COLOR[d.category] || C.textMuted, flexShrink: 0 }}>
                    {CAT_ICON[d.category] || <Box size={14} />}
                  </span>
                  <span style={{
                    flex: 1, fontSize: 11, color: sel ? C.text : C.textMuted,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {d.label || 'Unnamed'}
                  </span>
                  <button onClick={e => { e.stopPropagation(); onDeleteDevice(d.id) }}
                    style={{
                      background: 'none', border: 'none', color: C.textDim,
                      cursor: 'pointer', padding: 2, opacity: 0.4, transition: 'opacity 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                  {onZoomToDevice && (
                    <button onClick={e => { e.stopPropagation(); onSelect(d.id); onZoomToDevice(d.id) }}
                      style={{
                        background: 'none', border: 'none', color: C.accent,
                        cursor: 'pointer', padding: 2, opacity: 0.4, transition: 'opacity 0.1s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}
                      title="Zoom to device"
                    >
                      <Locate size={12} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
