'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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

/* Resolution bucket for filter chips */
function resBucket(res: string | null): string | null {
  if (!res) return null
  const mp = parseInt(res)
  if (isNaN(mp)) return null
  if (mp <= 2) return '2MP'
  if (mp <= 4) return '4MP'
  if (mp <= 5) return '5MP'
  if (mp <= 8) return '8MP'
  return '12MP+'
}

const chipStyle = (active: boolean): React.CSSProperties => ({
  padding: '2px 7px', fontSize: 9, fontWeight: 600, borderRadius: 3, cursor: 'pointer',
  fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.12s', border: 'none',
  background: active ? C.accentSubtle : C.bgActive,
  color: active ? C.accent : C.textDim,
  outline: active ? `1px solid ${C.accent}` : `1px solid transparent`,
})

/* =========== DEVICE CATALOG — IPVM-style browsable grid =========== */
function DeviceCatalog({ category, onSelect, selectedId }: { category: string; onSelect: (d: DeviceSearchResult) => void; selectedId?: string | null }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DeviceSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [filterVendor, setFilterVendor] = useState<string | null>(null)
  const [filterRes, setFilterRes] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasMounted = useRef(false)

  const doFetch = useCallback(async (q: string) => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '30' })
    if (category) params.set('category', category)
    if (q.trim()) params.set('q', q.trim())
    try {
      const res = await fetch(`/api/org/device-library/search?${params}`)
      if (res.ok) { const json = await res.json(); setResults(json.results ?? []) }
    } finally { setLoading(false) }
  }, [category])

  /* Auto-load on mount / category change */
  useEffect(() => {
    setQuery('')
    setFilterVendor(null)
    setFilterRes(null)
    setResults([])
    doFetch('')
    hasMounted.current = true
  }, [category, doFetch])

  function handleSearch(val: string) {
    setQuery(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => doFetch(val), 300)
  }

  /* Derive filter options from results */
  const vendors = [...new Set(results.map((r) => r.vendor).filter(Boolean))].sort()
  const resolutions = [...new Set(results.map((r) => resBucket(r.resolution)).filter(Boolean) as string[])].sort()

  /* Apply client-side filters */
  const filtered = results.filter((r) => {
    if (filterVendor && r.vendor !== filterVendor) return false
    if (filterRes && resBucket(r.resolution) !== filterRes) return false
    return true
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Search input */}
      <div style={{ padding: '8px 8px 4px', flexShrink: 0 }}>
        <input value={query} onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search manufacturer, model..."
          style={{ width: '100%', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 4, padding: '5px 8px', fontSize: 11, color: C.text, outline: 'none', fontFamily: 'inherit' }} />
      </div>

      {/* Filter chips */}
      {(vendors.length > 1 || resolutions.length > 1) && (
        <div style={{ padding: '2px 8px 4px', display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
          {/* Manufacturer chips */}
          {vendors.length > 1 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              <button onClick={() => setFilterVendor(null)} style={chipStyle(!filterVendor)}>All</button>
              {vendors.slice(0, 8).map((v) => (
                <button key={v} onClick={() => setFilterVendor(filterVendor === v ? null : v)} style={chipStyle(filterVendor === v)}>{v}</button>
              ))}
            </div>
          )}
          {/* Resolution chips */}
          {resolutions.length > 1 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {resolutions.map((r) => (
                <button key={r} onClick={() => setFilterRes(filterRes === r ? null : r)} style={chipStyle(filterRes === r)}>{r}</button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Results count */}
      <div style={{ padding: '2px 8px 4px', fontSize: 9, color: C.textDim, flexShrink: 0 }}>
        {loading ? 'Loading...' : `${filtered.length} device${filtered.length !== 1 ? 's' : ''}`}
      </div>

      {/* Device cards — scrollable */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 6px 6px' }}>
        {filtered.map((item) => {
          const isSel = selectedId === item.id
          const specs = (item.specs ?? {}) as Record<string, unknown>
          const focalLen = specs.focal_length as string | undefined
          return (
            <div key={item.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/panteray-device', JSON.stringify(item))
                e.dataTransfer.effectAllowed = 'copy'
              }}
              onClick={() => onSelect(item)}
              style={{
                padding: '7px 8px', marginBottom: 3, borderRadius: 4, cursor: 'grab',
                background: isSel ? 'rgba(59,130,246,0.1)' : C.bgActive,
                border: isSel ? `1px solid ${C.accent}` : `1px solid ${C.borderSubtle}`,
                transition: 'all 0.12s',
              }}
              onMouseEnter={(e) => { if (!isSel) { e.currentTarget.style.background = C.bgHover; e.currentTarget.style.borderColor = C.border } }}
              onMouseLeave={(e) => { if (!isSel) { e.currentTarget.style.background = C.bgActive; e.currentTarget.style.borderColor = C.borderSubtle } }}>
              {/* Row 1: Vendor + Model */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: C.text }}>{item.vendor}</span>
                <span style={{ fontSize: 10, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.model}</span>
              </div>
              {/* Row 2: Part number */}
              {item.partnumber && (
                <div style={{ fontSize: 9, color: C.textDim, fontFamily: "'IBM Plex Mono', monospace", marginBottom: 3 }}>{item.partnumber}</div>
              )}
              {/* Row 3: Spec badges */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {item.resolution && (
                  <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'rgba(59,130,246,0.1)', color: C.accent }}>{item.resolution}</span>
                )}
                {item.wattage != null && item.wattage > 0 && (
                  <span style={{ fontSize: 8, fontWeight: 600, padding: '1px 5px', borderRadius: 3, background: 'rgba(34,197,94,0.1)', color: C.green }}>
                    {item.wattage}W{item.poe_standard ? ` ${item.poe_standard}` : ''}
                  </span>
                )}
                {focalLen && (
                  <span style={{ fontSize: 8, fontWeight: 600, padding: '1px 5px', borderRadius: 3, background: 'rgba(139,92,246,0.1)', color: '#a78bfa' }}>{focalLen}mm</span>
                )}
                {item.ndaa_compliant === true && (
                  <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'rgba(34,197,94,0.08)', color: C.green }}>NDAA</span>
                )}
                {item.ndaa_compliant === false && (
                  <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'rgba(239,68,68,0.08)', color: C.red }}>!NDAA</span>
                )}
              </div>
              {/* Selected indicator */}
              {isSel && (
                <div style={{ marginTop: 4, fontSize: 9, color: C.accent, fontWeight: 600 }}>Click canvas to place</div>
              )}
            </div>
          )
        })}
        {!loading && filtered.length === 0 && results.length > 0 && (
          <div style={{ padding: 12, textAlign: 'center', fontSize: 10, color: C.textDim }}>No matches for current filters</div>
        )}
        {!loading && results.length === 0 && hasMounted.current && (
          <div style={{ padding: 12, textAlign: 'center', fontSize: 10, color: C.textDim }}>No devices in library for this category</div>
        )}
      </div>
    </div>
  )
}

/* =========== MAIN LEFT PANEL =========== */
export function LeftPanel({ devices, selectedId, onSelectDevice, onChangeModel, zones = [], selectedZoneId, onSelectZone, onDeleteZone, activeCategory, onDeviceSelected, pendingDevice }: LeftPanelProps) {
  const showCatalog = activeCategory && activeCategory !== 'layers' && onDeviceSelected
  return (
    <div
      style={{
        width: showCatalog ? 280 : 200,
        height: '100%',
        background: C.bgPanel,
        borderRight: `1px solid ${C.border}`,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
        transition: 'width 0.15s',
      }}
    >
      {/* Catalog mode — full panel is the device browser */}
      {showCatalog ? (
        <DeviceCatalog category={activeCategory} onSelect={onDeviceSelected} selectedId={pendingDevice?.id} />
      ) : (
        <>
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
        </>
      )}
    </div>
  )
}
