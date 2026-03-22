'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { C } from './constants'
import { Plus, Search, ChevronDown, ChevronUp, Eye, EyeOff, Trash2, Copy } from 'lucide-react'
import type { DesignDevice, DeviceSearchResult } from '@/types/database'

interface LeftPanelProps {
  devices: DesignDevice[]
  selectedId: string | null
  onSelectDevice: (id: string) => void
  onChangeModel?: (deviceId: string) => void
  activeCategory?: string | null
  onDeviceSelected?: (device: DeviceSearchResult) => void
  pendingDevice?: DeviceSearchResult | null
  onDuplicate?: (id: string) => void
  onDelete?: (id: string) => void
}

/** Icon for device category */
function CategoryDot({ category }: { category: string }) {
  const colors: Record<string, string> = {
    cctv: '#3b82f6', dome: '#3b82f6', bullet: '#3b82f6', turret: '#3b82f6',
    ptz: '#8b5cf6', fisheye: '#6366f1',
    multisensor_quad: '#06b6d4', multisensor_dual: '#06b6d4',
    access_control: '#f59e0b', door: '#f59e0b',
    network: '#10b981', switch: '#10b981', nvr: '#10b981',
    av: '#ec4899', speaker: '#ec4899',
    vape_environmental: '#ef4444', sensors: '#ef4444',
  }
  return (
    <div style={{
      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
      background: colors[category] || C.textDim,
    }} />
  )
}

/** Group devices by category for inventory table display */
function groupDevices(devices: DesignDevice[]): Map<string, DesignDevice[]> {
  const groups = new Map<string, DesignDevice[]>()
  const order = ['cctv', 'dome', 'bullet', 'turret', 'ptz', 'fisheye', 'multisensor_quad', 'multisensor_dual', 'access_control', 'door', 'network', 'switch', 'nvr', 'av', 'speaker', 'vape_environmental', 'sensors', 'other']
  for (const d of devices) {
    const key = d.category
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(d)
  }
  // Sort groups by predefined order
  const sorted = new Map<string, DesignDevice[]>()
  for (const cat of order) { if (groups.has(cat)) sorted.set(cat, groups.get(cat)!) }
  for (const [k, v] of groups) { if (!sorted.has(k)) sorted.set(k, v) }
  return sorted
}

function categoryLabel(cat: string): string {
  const labels: Record<string, string> = {
    cctv: 'Cameras', dome: 'Cameras', bullet: 'Cameras', turret: 'Cameras',
    ptz: 'PTZ Cameras', fisheye: 'Fisheye',
    multisensor_quad: 'Multi-Sensor', multisensor_dual: 'Multi-Sensor',
    access_control: 'Access Control', door: 'Doors',
    network: 'Network', switch: 'Switches', nvr: 'NVR/Storage',
    av: 'A/V', speaker: 'Speakers',
    vape_environmental: 'Environmental', sensors: 'Sensors',
    other: 'Other',
  }
  return labels[cat] || cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function LeftPanel({ devices, selectedId, onSelectDevice, onDuplicate, onDelete }: LeftPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<'label' | 'category' | 'model'>('category')
  const searchRef = useRef<HTMLInputElement>(null)

  // Filter devices by search
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return devices
    const q = searchQuery.toLowerCase()
    return devices.filter(d => {
      const p = (d.properties ?? {}) as Record<string, unknown>
      return (d.label || '').toLowerCase().includes(q) ||
        (String(p.model || '')).toLowerCase().includes(q) ||
        (String(p.manufacturer || '')).toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q)
    })
  }, [devices, searchQuery])

  const groups = useMemo(() => groupDevices(filtered), [filtered])

  const toggleGroup = (cat: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  // Keyboard shortcut: Cmd/Ctrl+F focuses search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div style={{
      width: 260, height: '100%', background: C.bgPanel,
      borderRight: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 10px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.text, letterSpacing: 0.3 }}>
          DEVICE INVENTORY
        </span>
        <span style={{
          fontSize: 10, fontWeight: 600, color: C.textMuted,
          background: C.bgActive, padding: '1px 6px', borderRadius: 8,
        }}>
          {devices.length}
        </span>
      </div>

      {/* Search bar */}
      <div style={{ padding: '6px 10px', borderBottom: `1px solid ${C.borderSubtle}` }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: C.bgActive, borderRadius: 6, padding: '4px 8px',
          border: `1px solid ${C.borderSubtle}`,
        }}>
          <Search size={12} color={C.textDim} />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search devices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: C.text, fontSize: 11, fontFamily: 'inherit',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                background: 'none', border: 'none', color: C.textDim,
                cursor: 'pointer', padding: 0, fontSize: 12, lineHeight: 1,
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Column headers — mini table style */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 50px 50px',
        padding: '4px 10px', borderBottom: `1px solid ${C.border}`,
        fontSize: 8, fontWeight: 700, color: C.textDim, textTransform: 'uppercase',
        letterSpacing: 0.8,
      }}>
        <span>Device</span>
        <span style={{ textAlign: 'center' }}>Qty</span>
        <span style={{ textAlign: 'right' }}>Status</span>
      </div>

      {/* Device list */}
      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 8 }}>
        {filtered.length === 0 && (
          <div style={{
            padding: '24px 12px', textAlign: 'center',
            fontSize: 11, color: C.textDim,
          }}>
            {searchQuery ? 'No devices match search' : 'No devices placed'}
          </div>
        )}

        {Array.from(groups.entries()).map(([cat, catDevices]) => {
          const isCollapsed = collapsedGroups.has(cat)
          return (
            <div key={cat}>
              {/* Category header */}
              <div
                onClick={() => toggleGroup(cat)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 10px', cursor: 'pointer',
                  background: C.bgSurface, borderBottom: `1px solid ${C.borderSubtle}`,
                  userSelect: 'none',
                }}
              >
                <CategoryDot category={cat} />
                <span style={{ fontSize: 10, fontWeight: 700, color: C.text, flex: 1 }}>
                  {categoryLabel(cat)}
                </span>
                <span style={{
                  fontSize: 9, color: C.textMuted, fontFamily: "'IBM Plex Mono', monospace",
                }}>
                  {catDevices.length}
                </span>
                {isCollapsed ? <ChevronDown size={10} color={C.textDim} /> : <ChevronUp size={10} color={C.textDim} />}
              </div>

              {/* Device rows */}
              {!isCollapsed && catDevices.map(d => {
                const p = (d.properties ?? {}) as Record<string, unknown>
                const manufacturer = String(p.manufacturer || '')
                const model = String(p.model || '')
                const isSelected = selectedId === d.id
                const statusColor =
                  d.status === 'existing_remove' ? C.red :
                  d.status === 'relocate' ? C.yellow :
                  d.status === 'existing_keep' ? C.textMuted : C.green
                const statusLabel =
                  d.status === 'existing_remove' ? 'REM' :
                  d.status === 'relocate' ? 'REL' :
                  d.status === 'existing_keep' ? 'EXT' : 'NEW'

                return (
                  <div
                    key={d.id}
                    onClick={() => onSelectDevice(d.id)}
                    style={{
                      display: 'grid', gridTemplateColumns: '1fr 50px 50px',
                      alignItems: 'center',
                      padding: '6px 10px', cursor: 'pointer',
                      background: isSelected ? C.accentSubtle : 'transparent',
                      borderLeft: isSelected ? `2px solid ${C.accent}` : '2px solid transparent',
                      borderBottom: `1px solid ${C.borderSubtle}`,
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = C.bgHover }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                  >
                    {/* Device info */}
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: 11, fontWeight: 600, color: C.text,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {d.label || 'Unlabeled'}
                      </div>
                      <div style={{
                        fontSize: 9, color: C.textMuted, marginTop: 1,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {manufacturer ? `${manufacturer} ${model}` : model || d.category}
                      </div>
                    </div>

                    {/* Color dot */}
                    <div style={{ textAlign: 'center' }}>
                      {d.color_hex && (
                        <div style={{
                          width: 8, height: 8, borderRadius: 2,
                          background: d.color_hex, display: 'inline-block',
                        }} />
                      )}
                    </div>

                    {/* Status badge */}
                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        fontSize: 7, fontWeight: 700, color: statusColor,
                        background: `${statusColor}14`,
                        padding: '1px 4px', borderRadius: 2,
                        fontFamily: "'IBM Plex Mono', monospace",
                      }}>
                        {statusLabel}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Bottom summary */}
      <div style={{
        padding: '6px 10px', borderTop: `1px solid ${C.border}`,
        display: 'flex', gap: 8, flexWrap: 'wrap',
        fontSize: 9, color: C.textDim,
      }}>
        {Array.from(groups.entries()).map(([cat, catDevices]) => (
          <span key={cat} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <CategoryDot category={cat} />
            {catDevices.length}
          </span>
        ))}
      </div>
    </div>
  )
}
