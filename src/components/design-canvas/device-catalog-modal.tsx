'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Search } from 'lucide-react'
import { C } from './constants'
import type { DeviceSearchResult } from '@/types/database'

interface DeviceCatalogModalProps {
  category: string
  onClose: () => void
  onSelect: (device: DeviceSearchResult) => void
}

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
  padding: '4px 10px', fontSize: 11, fontWeight: 500, borderRadius: 4, cursor: 'pointer',
  fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.12s', border: 'none',
  background: active ? C.accentSubtle : C.bgActive,
  color: active ? C.accent : C.textDim,
  outline: active ? `1px solid ${C.accent}` : `1px solid transparent`,
})

export function DeviceCatalogModal({ category, onClose, onSelect }: DeviceCatalogModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DeviceSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [filterVendor, setFilterVendor] = useState<string | null>(null)
  const [filterRes, setFilterRes] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasMounted = useRef(false)

  const doFetch = useCallback(async (q: string) => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '100' }) // Increased limit for full-screen view
    if (category) params.set('category', category)
    if (q.trim()) params.set('q', q.trim())
    try {
      const res = await fetch(`/api/org/device-library/search?${params}`)
      if (res.ok) { const json = await res.json(); setResults(json.results ?? []) }
    } finally { setLoading(false) }
  }, [category])

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

  const vendors = [...new Set(results.map((r) => r.vendor).filter(Boolean))].sort()
  const resolutions = [...new Set(results.map((r) => resBucket(r.resolution)).filter(Boolean) as string[])].sort()

  const filtered = results.filter((r) => {
    if (filterVendor && r.vendor !== filterVendor) return false
    if (filterRes && resBucket(r.resolution) !== filterRes) return false
    return true
  })

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      backgroundColor: 'rgba(0,0,0,0.6)', 
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
      padding: '40px'
    }}>
      <div style={{
        backgroundColor: C.bgPanel, 
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        width: '100%', maxWidth: 1200, height: '100%', maxHeight: 800,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ 
          padding: '16px 24px', borderBottom: `1px solid ${C.border}`, 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          backgroundColor: C.bgSurface 
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: C.text }}>Select Device</h2>
            <p style={{ margin: 0, marginTop: 4, fontSize: 13, color: C.textDim }}>Browse the library and select a device to map onto the system design canvas.</p>
          </div>
          <button onClick={onClose} style={{ 
            background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer',
            padding: 8, borderRadius: '50%', display: 'flex'
          }} onMouseEnter={e => e.currentTarget.style.backgroundColor = C.bgHover} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
            <X size={20} />
          </button>
        </div>

        {/* Filters Bar */}
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.border}`, backgroundColor: C.bg }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: C.textMuted }} />
              <input value={query} onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search manufacturer, model or part number..."
                style={{ 
                  width: '100%', background: C.bgActive, border: `1px solid ${C.border}`, 
                  borderRadius: 6, padding: '8px 12px 8px 36px', fontSize: 14, color: C.text, 
                  outline: 'none', fontFamily: 'inherit' 
                }} />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: '60%' }}>
               {vendors.length > 1 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <span style={{ fontSize: 11, color: C.textMuted, alignSelf: 'center', marginRight: 4 }}>Brand:</span>
                  <button onClick={() => setFilterVendor(null)} style={chipStyle(!filterVendor)}>All</button>
                  {vendors.slice(0, 8).map((v) => (
                    <button key={v} onClick={() => setFilterVendor(filterVendor === v ? null : v)} style={chipStyle(filterVendor === v)}>{v}</button>
                  ))}
                </div>
              )}
              {resolutions.length > 1 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <span style={{ fontSize: 11, color: C.textMuted, alignSelf: 'center', marginRight: 4 }}>Resolution:</span>
                  {resolutions.map((r) => (
                    <button key={r} onClick={() => setFilterRes(filterRes === r ? null : r)} style={chipStyle(filterRes === r)}>{r}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table Header */}
        <div style={{ 
          display: 'grid', gridTemplateColumns: 'minmax(150px, 1fr) minmax(200px, 2fr) 100px 100px 100px 100px 80px', 
          gap: 16, padding: '12px 24px', borderBottom: `1px solid ${C.border}`,
          backgroundColor: C.bgSurface, fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5
        }}>
          <div>Manufacturer</div>
          <div>Model & Part No.</div>
          <div>Type</div>
          <div>Resolution</div>
          <div>Lens</div>
          <div>Power</div>
          <div>Compliance</div>
        </div>

        {/* Results List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px', backgroundColor: C.bgHover }}>
          {loading ? (
             <div style={{ padding: 40, textAlign: 'center', fontSize: 14, color: C.textDim }}>Searching device library...</div>
          ) : filtered.length === 0 ? (
             <div style={{ padding: 40, textAlign: 'center', fontSize: 14, color: C.textDim }}>
               {hasMounted.current ? 'No devices match your search criteria.' : ''}
             </div>
          ) : (
            filtered.map((item) => {
              const specs = (item.specs ?? {}) as Record<string, unknown>
              const focalLen = specs.focal_length as string | undefined
              const fps = specs.fps as string | number | undefined
              return (
                <div key={item.id}
                  onClick={() => onSelect(item)}
                  style={{
                    display: 'grid', gridTemplateColumns: 'minmax(150px, 1fr) minmax(200px, 2fr) 100px 100px 100px 100px 80px', 
                    gap: 16, padding: '12px 16px', margin: '4px 0',
                    backgroundColor: C.bgPanel, border: `1px solid ${C.borderSubtle}`, borderRadius: 6,
                    cursor: 'pointer', alignItems: 'center', transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.borderSubtle; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
                >
                  <div style={{ fontWeight: 600, color: C.text, fontSize: 13 }}>{item.vendor}</div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{item.model}</span>
                    {item.partnumber && <span style={{ fontSize: 11, color: C.textDim, fontFamily: "'IBM Plex Mono', monospace" }}>{item.partnumber}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted, textTransform: 'capitalize' }}>{(item.subcategory || item.category || 'Device').replace(/_/g, ' ')}</div>
                  
                  <div>
                    {item.resolution ? (
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: 'rgba(59,130,246,0.1)', color: C.accent }}>{item.resolution}</span>
                    ) : <span style={{ color: C.textDim }}>-</span>}
                    {fps && <div style={{ fontSize: 10, color: C.textDim, marginTop: 4 }}>{fps} fps</div>}
                  </div>
                  
                  <div>
                    {focalLen ? (
                       <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: 'rgba(139,92,246,0.1)', color: '#a78bfa' }}>{focalLen}mm</span>
                    ) : <span style={{ color: C.textDim }}>-</span>}
                  </div>
                  
                  <div>
                    {item.wattage != null && item.wattage > 0 ? (
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: 'rgba(34,197,94,0.1)', color: C.green }}>
                        {item.wattage}W{item.poe_standard ? ` ${item.poe_standard.toUpperCase()}` : ''}
                      </span>
                    ) : <span style={{ color: C.textDim }}>-</span>}
                  </div>
                  
                  <div>
                     {item.ndaa_compliant === true && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3, border: `1px solid ${C.green}`, color: C.green }}>NDAA</span>
                    )}
                    {item.ndaa_compliant === false && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3, border: `1px solid ${C.red}`, color: C.red }}>!NDAA</span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
