'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { C } from './constants'
import type { DesignDevice, DesignZone, DeviceSearchResult } from '@/types/database'

interface LeftPanelProps {
  devices: DesignDevice[]
  selectedId: string | null
  onSelectDevice: (id: string) => void
  onChangeModel?: (deviceId: string) => void
  zones?: DesignZone[]
  selectedZoneId?: string | null
  onSelectZone?: (id: string) => void
  onDeleteZone?: (id: string) => void
  activeCategory?: string | null
  onDeviceSelected?: (device: DeviceSearchResult) => void
  pendingDevice?: DeviceSearchResult | null
}

/* Inline device library search — matches canvas dark theme */
function DeviceSearch({ category, onSelect }: { category?: string; onSelect: (d: DeviceSearchResult) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DeviceSearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setOpen(false); return }
    setLoading(true)
    const params = new URLSearchParams({ q, limit: '12' })
    if (category) params.set('category', category)
    try {
      const res = await fetch(`/api/org/device-library/search?${params}`)
      if (res.ok) { const json = await res.json(); setResults(json.results ?? []); setOpen(true); setActiveIdx(0) }
    } finally { setLoading(false) }
  }, [category])

  function handleChange(val: string) {
    setQuery(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => doSearch(val), 300)
  }
  function handleSelect(d: DeviceSearchResult) {
    setQuery(`${d.vendor} ${d.model}`)
    setOpen(false)
    onSelect(d)
  }
  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); handleSelect(results[activeIdx]) }
    else if (e.key === 'Escape') { setOpen(false) }
  }

  useEffect(() => {
    function onClick(e: MouseEvent) { if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div ref={wrapperRef} style={{ position: 'relative', padding: '8px 10px' }}>
      <input value={query} onChange={(e) => handleChange(e.target.value)} onKeyDown={handleKeyDown}
        onFocus={() => { if (results.length > 0) setOpen(true) }}
        placeholder="Search device library..."
        style={{ width: '100%', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 4, padding: '5px 8px', fontSize: 11, color: C.text, outline: 'none', fontFamily: 'inherit' }} />
      {loading && <div style={{ position: 'absolute', right: 16, top: 14, width: 12, height: 12, border: `2px solid ${C.textDim}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />}
      {open && results.length > 0 && (
        <div style={{ position: 'absolute', zIndex: 30, left: 10, right: 10, top: '100%', maxHeight: 240, overflowY: 'auto', background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
          {results.map((item, idx) => (
            <div key={item.id} onClick={() => handleSelect(item)}
              style={{ padding: '6px 10px', cursor: 'pointer', fontSize: 10, borderBottom: `1px solid ${C.borderSubtle}`, background: idx === activeIdx ? C.bgHover : 'transparent', display: 'flex', flexDirection: 'column', gap: 1 }}
              onMouseEnter={() => setActiveIdx(idx)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {item.ndaa_compliant === true && <span style={{ fontSize: 8, color: C.green, fontWeight: 700 }}>NDAA</span>}
                {item.ndaa_compliant === false && <span style={{ fontSize: 8, color: C.red, fontWeight: 700 }}>!NDAA</span>}
                <span style={{ fontWeight: 600, color: C.text }}>{item.vendor}</span>
                <span style={{ color: C.textMuted }}>{item.model}</span>
              </div>
              {(item.partnumber || item.resolution) && (
                <div style={{ fontSize: 9, color: C.textDim, fontFamily: "'IBM Plex Mono', monospace" }}>
                  {item.partnumber}{item.partnumber && item.resolution ? ' · ' : ''}{item.resolution}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {open && results.length === 0 && query.trim() && !loading && (
        <div style={{ position: 'absolute', zIndex: 30, left: 10, right: 10, top: '100%', padding: 12, background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 10, color: C.textDim }}>No devices found</div>
      )}
    </div>
  )
}

export function LeftPanel({ devices, selectedId, onSelectDevice, onChangeModel, zones = [], selectedZoneId, onSelectZone, onDeleteZone, activeCategory, onDeviceSelected, pendingDevice }: LeftPanelProps) {
  return (
    <div
      style={{
        width: 200,
        height: '100%',
        background: C.bgPanel,
        borderRight: `1px solid ${C.border}`,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '10px 12px',
          borderBottom: `1px solid ${C.border}`,
          fontSize: 11,
          fontWeight: 600,
          color: C.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
        }}
      >
        On Map ({devices.length})
      </div>

      {/* Device library search — shown when a category tab is active */}
      {activeCategory && activeCategory !== 'layers' && onDeviceSelected && (
        <div style={{ borderBottom: `1px solid ${C.border}` }}>
          <DeviceSearch category={activeCategory} onSelect={onDeviceSelected} />
          {pendingDevice && (
            <div style={{ padding: '6px 10px', background: 'rgba(59,130,246,0.08)', borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ fontSize: 9, color: C.accent, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Ready to place</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text }}>{pendingDevice.vendor} {pendingDevice.model}</div>
              {pendingDevice.partnumber && <div style={{ fontSize: 9, color: C.textDim, fontFamily: "'IBM Plex Mono', monospace" }}>{pendingDevice.partnumber}</div>}
              <div style={{ fontSize: 9, color: C.textMuted }}>Click on canvas to place</div>
            </div>
          )}
          {!pendingDevice && (
            <div style={{ padding: '4px 10px 8px', fontSize: 9, color: C.textDim }}>
              Search to select a device, then click canvas to place
            </div>
          )}
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
        {devices.length === 0 && (
          <div
            style={{
              padding: '20px 12px',
              textAlign: 'center',
              fontSize: 11,
              color: C.textDim,
            }}
          >
            No devices placed
          </div>
        )}
        {devices.map((d) => {
          const props = (d.properties ?? {}) as Record<string, unknown>
          const channels = (props.channels as number) || 1
          const manufacturer = (props.manufacturer as string) || ''
          const model = (props.model as string) || d.label || 'Unknown'
          const isSelected = selectedId === d.id

          return (
            <div
              key={d.id}
              onClick={() => onSelectDevice(d.id)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                borderBottom: `1px solid ${C.borderSubtle}`,
                background: isSelected ? C.accentSubtle : 'transparent',
                borderLeft: isSelected
                  ? `2px solid ${C.accent}`
                  : '2px solid transparent',
                transition: 'background 0.12s',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.background = C.bgHover
              }}
              onMouseLeave={(e) => {
                if (!isSelected) e.currentTarget.style.background = 'transparent'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>
                  {manufacturer || d.category}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {channels > 1 && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: C.yellow,
                        background: 'rgba(234,179,8,0.12)',
                        padding: '1px 5px',
                        borderRadius: 4,
                      }}
                    >
                      {channels}ch
                    </span>
                  )}
                  {d.color_hex && (
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: d.color_hex,
                      }}
                    />
                  )}
                </div>
              </div>
              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>
                {model}
              </div>
              {onChangeModel && (
                <div
                  onClick={(e) => {
                    e.stopPropagation()
                    onChangeModel(d.id)
                  }}
                  style={{
                    fontSize: 9,
                    color: C.accent,
                    marginTop: 3,
                    opacity: 0.8,
                    cursor: 'pointer',
                  }}
                >
                  Change Model
                </div>
              )}
            </div>
          )
        })}

        {/* ---- Zones Section ---- */}
        {zones.length > 0 && (
          <>
            <div
              style={{
                padding: '10px 12px 6px',
                borderTop: `1px solid ${C.border}`,
                fontSize: 11,
                fontWeight: 600,
                color: C.textMuted,
                textTransform: 'uppercase',
                letterSpacing: 0.8,
                marginTop: 4,
              }}
            >
              Zones ({zones.length})
            </div>
            {zones.map((z) => {
              const isSelected = selectedZoneId === z.id
              return (
                <div
                  key={z.id}
                  onClick={() => onSelectZone?.(z.id)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    borderBottom: `1px solid ${C.borderSubtle}`,
                    background: isSelected ? `${z.color}15` : 'transparent',
                    borderLeft: isSelected
                      ? `2px solid ${z.color}`
                      : '2px solid transparent',
                    transition: 'background 0.12s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = C.bgHover
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 2,
                        background: z.color,
                        border: '1px solid rgba(255,255,255,0.15)',
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>{z.name}</span>
                  </div>
                  {onDeleteZone && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteZone(z.id) }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: C.textDim,
                        cursor: 'pointer',
                        padding: '0 2px',
                        fontSize: 12,
                        lineHeight: 1,
                        opacity: 0.6,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.opacity = '1' }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = C.textDim; e.currentTarget.style.opacity = '0.6' }}
                    >
                      x
                    </button>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
