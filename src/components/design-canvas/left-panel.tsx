'use client'
/**
 * LeftPanel — Device inventory with quantity pool (Hanwha DesignPro style).
 *
 * Groups devices by model (device_library_item_id). Each model shows:
 *   - Editable quantity (−/count/+)
 *   - "On Map" devices with [locate] [remove] actions
 *   - "Available" pool devices with [+ Place] action
 */

import React, { useState, useMemo } from 'react'
import {
  Plus, Minus, Cctv, DoorOpen, Network, Speaker, Cpu, Box,
  Locate, MapPinOff, MapPin, ChevronDown, ChevronRight, Trash2,
} from 'lucide-react'
import { C } from './constants'
import type { DesignDevice } from '@/types/database'

const CAT_ICON: Record<string, React.ReactNode> = {
  cctv: <Cctv size={14} />, dome: <Cctv size={14} />, bullet: <Cctv size={14} />,
  turret: <Cctv size={14} />, ptz: <Cctv size={14} />, fisheye: <Cctv size={14} />,
  multisensor_quad: <Cctv size={14} />, multisensor_dual: <Cctv size={14} />,
  access_control: <DoorOpen size={14} />, network: <Network size={14} />,
  av: <Speaker size={14} />, vape_environmental: <Cpu size={14} />,
}
const CAT_COLOR: Record<string, string> = {
  cctv: '#3b82f6', dome: '#3b82f6', bullet: '#3b82f6', turret: '#3b82f6',
  ptz: '#8b5cf6', fisheye: '#06b6d4', multisensor_quad: '#a855f7', multisensor_dual: '#a855f7',
  access_control: '#f97316', network: '#22c55e', av: '#eab308', vape_environmental: '#ef4444',
}

interface ModelGroup {
  libraryItemId: string | null
  modelName: string
  category: string
  devices: DesignDevice[]
  placed: DesignDevice[]
  available: DesignDevice[]
}

interface Props {
  /** ALL devices in this area (including unplaced) */
  devices: DesignDevice[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onAddDevice: () => void
  onDeleteDevice: (id: string) => void
  onZoomToDevice?: (id: string) => void
  onPlaceDevice?: (id: string) => void
  onRemoveFromMap?: (id: string) => void
  onUpdateQuantity?: (libraryItemId: string, newQty: number, templateDevice: DesignDevice) => void
}

export function LeftPanel({
  devices, selectedId, onSelect, onAddDevice, onDeleteDevice,
  onZoomToDevice, onPlaceDevice, onRemoveFromMap, onUpdateQuantity,
}: Props) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  // Group devices by model (device_library_item_id)
  const modelGroups = useMemo(() => {
    const map = new Map<string, ModelGroup>()

    for (const d of devices) {
      const libId = d.device_library_item_id || `custom_${d.id}`
      const props = (d.properties ?? {}) as Record<string, unknown>
      const isUnplaced = !!props.unplaced

      if (!map.has(libId)) {
        const vendor = (props.vendor as string) || ''
        const model = (props.model as string) || ''
        const modelName = vendor && model ? `${vendor} ${model}` : d.label || 'Custom Device'
        map.set(libId, {
          libraryItemId: d.device_library_item_id,
          modelName,
          category: d.category,
          devices: [],
          placed: [],
          available: [],
        })
      }

      const group = map.get(libId)!
      group.devices.push(d)
      if (isUnplaced) {
        group.available.push(d)
      } else {
        group.placed.push(d)
      }
    }

    // Sort groups: cameras first, then by model name
    return [...map.entries()].sort((a, b) => {
      const catA = a[1].category
      const catB = b[1].category
      const isCamA = ['cctv', 'dome', 'bullet', 'turret', 'ptz', 'fisheye', 'multisensor_quad', 'multisensor_dual'].includes(catA)
      const isCamB = ['cctv', 'dome', 'bullet', 'turret', 'ptz', 'fisheye', 'multisensor_quad', 'multisensor_dual'].includes(catB)
      if (isCamA !== isCamB) return isCamA ? -1 : 1
      return a[1].modelName.localeCompare(b[1].modelName)
    })
  }, [devices])

  const toggleCollapse = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const totalDevices = devices.length
  const placedCount = devices.filter(d => !(d.properties as Record<string, unknown> | null)?.unplaced).length

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
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
            Devices
          </span>
          <span style={{ fontSize: 9, color: C.textDim }}>
            {placedCount} placed · {totalDevices - placedCount} available
          </span>
        </div>
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

      {/* Device list grouped by model */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {modelGroups.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center', color: C.textDim, fontSize: 11 }}>
            No devices yet.<br />
            Click &ldquo;Add&rdquo; to browse the catalog.
          </div>
        )}

        {modelGroups.map(([key, group]) => {
          const isCollapsed = collapsedGroups.has(key)
          const total = group.devices.length
          const placed = group.placed.length
          const catColor = CAT_COLOR[group.category] || C.textMuted
          const catIcon = CAT_ICON[group.category] || <Box size={14} />

          return (
            <div key={key} style={{ borderBottom: `1px solid ${C.borderSubtle}` }}>
              {/* Model header */}
              <div
                onClick={() => toggleCollapse(key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 10px', cursor: 'pointer',
                  background: C.bgHover,
                }}
              >
                <span style={{ color: catColor, flexShrink: 0 }}>{catIcon}</span>
                {isCollapsed ? <ChevronRight size={12} color={C.textDim} /> : <ChevronDown size={12} color={C.textDim} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div title={group.modelName} style={{
                    fontSize: 11, fontWeight: 600, color: C.text,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {group.modelName}
                  </div>
                  <div style={{ fontSize: 9, color: C.textDim }}>
                    {placed}/{total} placed
                  </div>
                </div>

                {/* Quantity controls */}
                {group.libraryItemId && onUpdateQuantity && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}
                    onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        if (total > placed) {
                          onUpdateQuantity(group.libraryItemId!, total - 1, group.devices[0])
                        }
                      }}
                      disabled={total <= placed}
                      style={{
                        width: 18, height: 18, borderRadius: 3, border: `1px solid ${C.border}`,
                        background: 'transparent', color: total <= placed ? C.borderSubtle : C.textMuted,
                        cursor: total <= placed ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                      }}
                    >
                      <Minus size={10} />
                    </button>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.text, minWidth: 18, textAlign: 'center' }}>
                      {total}
                    </span>
                    <button
                      onClick={() => onUpdateQuantity(group.libraryItemId!, total + 1, group.devices[0])}
                      style={{
                        width: 18, height: 18, borderRadius: 3, border: `1px solid ${C.border}`,
                        background: 'transparent', color: C.textMuted, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                      }}
                    >
                      <Plus size={10} />
                    </button>
                  </div>
                )}
              </div>

              {/* Expanded device list */}
              {!isCollapsed && (
                <div style={{ padding: '2px 0' }}>
                  {/* Placed devices */}
                  {group.placed.map(d => {
                    const sel = d.id === selectedId
                    return (
                      <div key={d.id}
                        onClick={() => onSelect(d.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '4px 10px 4px 28px', cursor: 'pointer',
                          background: sel ? C.accentSubtle : 'transparent',
                          borderLeft: sel ? `2px solid ${C.accent}` : '2px solid transparent',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => { if (!sel) e.currentTarget.style.background = C.bgHover }}
                        onMouseLeave={e => { if (!sel) e.currentTarget.style.background = sel ? C.accentSubtle : 'transparent' }}
                      >
                        <MapPin size={10} color="#22c55e" style={{ flexShrink: 0 }} />
                        <span title={d.label || 'Unnamed'} style={{
                          flex: 1, fontSize: 10, color: sel ? C.text : C.textMuted,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {d.label || 'Unnamed'}
                        </span>
                        {onZoomToDevice && (
                          <button onClick={e => { e.stopPropagation(); onSelect(d.id); onZoomToDevice(d.id) }}
                            title="Locate on map"
                            style={{
                              background: 'none', border: 'none', color: C.accent,
                              cursor: 'pointer', padding: 2, opacity: 0.4, transition: 'opacity 0.1s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                            onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}
                          >
                            <Locate size={10} />
                          </button>
                        )}
                        {onRemoveFromMap && (
                          <button onClick={e => { e.stopPropagation(); onRemoveFromMap(d.id) }}
                            title="Remove from map"
                            style={{
                              background: 'none', border: 'none', color: '#f97316',
                              cursor: 'pointer', padding: 2, opacity: 0.4, transition: 'opacity 0.1s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                            onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}
                          >
                            <MapPinOff size={10} />
                          </button>
                        )}
                      </div>
                    )
                  })}

                  {/* Available (unplaced) devices */}
                  {group.available.map(d => {
                    return (
                      <div key={d.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '4px 10px 4px 28px',
                        }}
                      >
                        <Box size={10} color={C.textDim} style={{ flexShrink: 0 }} />
                        <span style={{
                          flex: 1, fontSize: 10, color: C.textDim,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {d.label || 'Unnamed'}
                        </span>
                        {onPlaceDevice && (
                          <button onClick={e => { e.stopPropagation(); onPlaceDevice(d.id) }}
                            title="Place on map"
                            style={{
                              display: 'flex', alignItems: 'center', gap: 2,
                              background: 'none', border: `1px solid ${C.border}`,
                              color: '#22c55e', cursor: 'pointer', padding: '1px 6px',
                              borderRadius: 3, fontSize: 9, fontWeight: 600,
                              fontFamily: 'inherit', transition: 'all 0.1s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(34,197,94,0.1)'; e.currentTarget.style.borderColor = '#22c55e' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = C.border }}
                          >
                            <Plus size={9} /> Place
                          </button>
                        )}
                        <button onClick={e => { e.stopPropagation(); onDeleteDevice(d.id) }}
                          title="Delete permanently"
                          style={{
                            background: 'none', border: 'none', color: C.textDim,
                            cursor: 'pointer', padding: 2, opacity: 0.3, transition: 'opacity 0.1s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '0.3')}
                        >
                          <Trash2 size={9} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
