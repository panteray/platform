'use client'
/**
 * LeftPanel — Device inventory list (Hanwha DesignPro style).
 *
 * Shows all devices placed in the current area with category icons,
 * labels, and quick-select. Supports grouping by category or color.
 * Color filter chips let users focus on specific color groups.
 */

import React, { useState } from 'react'
import { Plus, Trash2, Cctv, DoorOpen, Network, Speaker, Cpu, Box, Locate, Palette } from 'lucide-react'
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
  /** When set, only devices with this color_hex are shown on canvas */
  onColorFilterChange?: (colors: Set<string> | null) => void
}

export function LeftPanel({ devices, selectedId, onSelect, onAddDevice, onDeleteDevice, onZoomToDevice, onColorFilterChange }: Props) {
  const [groupBy, setGroupBy] = useState<'category' | 'color'>('category')
  const [activeColors, setActiveColors] = useState<Set<string> | null>(null)

  // Collect unique colors used by devices
  const usedColors = React.useMemo(() => {
    const s = new Set<string>()
    for (const d of devices) {
      const c = (d as unknown as Record<string, unknown>).color_hex as string | undefined
      if (c) s.add(c)
    }
    return Array.from(s).sort()
  }, [devices])

  // Group devices
  const groups = React.useMemo(() => {
    const map = new Map<string, DesignDevice[]>()
    const filtered = activeColors
      ? devices.filter(d => {
          const c = (d as unknown as Record<string, unknown>).color_hex as string | undefined
          return c && activeColors.has(c)
        })
      : devices

    for (const d of filtered) {
      const key = groupBy === 'color'
        ? ((d as unknown as Record<string, unknown>).color_hex as string || 'unassigned')
        : d.category
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(d)
    }
    return map
  }, [devices, groupBy, activeColors])

  const toggleColorFilter = (color: string) => {
    setActiveColors(prev => {
      let next: Set<string> | null
      if (!prev) {
        next = new Set([color])
      } else if (prev.has(color)) {
        const copy = new Set(prev)
        copy.delete(color)
        next = copy.size === 0 ? null : copy
      } else {
        next = new Set(prev)
        next.add(color)
      }
      onColorFilterChange?.(next)
      return next
    })
  }

  const clearColorFilter = () => {
    setActiveColors(null)
    onColorFilterChange?.(null)
  }

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
          Devices ({activeColors ? groups.size : devices.length})
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setGroupBy(g => g === 'category' ? 'color' : 'category')}
            title={`Group by ${groupBy === 'category' ? 'color' : 'category'}`}
            style={{
              display: 'flex', alignItems: 'center', padding: '4px 6px',
              background: groupBy === 'color' ? C.accentSubtle : 'transparent',
              color: groupBy === 'color' ? C.accent : C.textMuted,
              border: `1px solid ${groupBy === 'color' ? C.accent : C.border}`,
              borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
            }}>
            <Palette size={12} />
          </button>
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
      </div>

      {/* Color filter chips (Hanwha DesignPro style) */}
      {usedColors.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 3, padding: '6px 12px',
          borderBottom: `1px solid ${C.borderSubtle}`,
        }}>
          {usedColors.map(color => {
            const isActive = activeColors?.has(color)
            return (
              <button key={color} onClick={() => toggleColorFilter(color)}
                style={{
                  width: 14, height: 14, borderRadius: '50%', background: color,
                  border: isActive ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
                  cursor: 'pointer', opacity: !activeColors || isActive ? 1 : 0.3,
                  transition: 'opacity 0.15s, border 0.15s',
                }}
                title={`Filter by ${color}`}
              />
            )
          })}
          {activeColors && (
            <button onClick={clearColorFilter}
              style={{
                fontSize: 9, padding: '1px 6px', background: 'transparent',
                color: C.textMuted, border: `1px solid ${C.border}`, borderRadius: 8,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
              Clear
            </button>
          )}
        </div>
      )}

      {/* Device list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {devices.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center', color: C.textDim, fontSize: 11 }}>
            No devices placed yet.<br />
            Click &ldquo;Add&rdquo; to browse the catalog.
          </div>
        )}

        {Array.from(groups.entries()).map(([key, devs]) => (
          <div key={key}>
            {/* Group header */}
            <div style={{
              padding: '6px 12px', fontSize: 9, fontWeight: 700,
              color: groupBy === 'color'
                ? (key === 'unassigned' ? C.textDim : key)
                : (CAT_COLOR[key] || C.textMuted),
              textTransform: 'uppercase', letterSpacing: '0.5px',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              {groupBy === 'color' && key !== 'unassigned' && (
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', background: key,
                  display: 'inline-block', flexShrink: 0,
                }} />
              )}
              {groupBy === 'color'
                ? (key === 'unassigned' ? 'No Color' : `Group`)
                : key.replace(/_/g, ' ')
              } ({devs.length})
            </div>

            {/* Device rows */}
            {devs.map(d => {
              const sel = d.id === selectedId
              const devColor = (d as unknown as Record<string, unknown>).color_hex as string | undefined
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
                  {/* Color dot */}
                  {devColor && (
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%', background: devColor,
                      flexShrink: 0,
                    }} />
                  )}
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
