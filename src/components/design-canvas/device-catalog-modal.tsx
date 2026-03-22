'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { X, Search, Star, Clock, Cctv } from 'lucide-react'
import { C } from './constants'
import type { DeviceSearchResult } from '@/types/database'

interface DeviceCatalogModalProps {
  category: string
  onClose: () => void
  onSelect: (device: DeviceSearchResult) => void
}

const FORM_TYPES: { id: string; label: string }[] = [
  { id: '', label: 'All' },
  { id: 'box', label: 'Box' },
  { id: 'bullet', label: 'Bullet' },
  { id: 'covert', label: 'Covert' },
  { id: 'cube', label: 'Cube' },
  { id: 'dome', label: 'Dome' },
  { id: 'ptz', label: 'PTZ' },
  { id: 'turret', label: 'Turret' },
  { id: 'fisheye', label: 'Fisheye' },
  { id: 'multisensor', label: 'Multi' },
]

/* SVG camera silhouette icons — actual camera form factor shapes */
function FormIcon({ type, color }: { type: string; color: string }) {
  const s = { width: 20, height: 16, fill: color }
  switch (type) {
    case 'box': return (
      <svg viewBox="0 0 24 16" {...s}><rect x="2" y="2" width="16" height="12" rx="1" fill="none" stroke={color} strokeWidth="1.5"/><rect x="18" y="4" width="4" height="6" rx="1" fill="none" stroke={color} strokeWidth="1.5"/></svg>
    )
    case 'bullet': return (
      <svg viewBox="0 0 24 16" {...s}><rect x="1" y="4" width="14" height="8" rx="4" fill="none" stroke={color} strokeWidth="1.5"/><circle cx="19" cy="8" r="3" fill="none" stroke={color} strokeWidth="1.5"/></svg>
    )
    case 'dome': return (
      <svg viewBox="0 0 24 16" {...s}><path d="M4 14 A8 8 0 0 1 20 14" fill="none" stroke={color} strokeWidth="1.5"/><line x1="2" y1="14" x2="22" y2="14" stroke={color} strokeWidth="1.5"/></svg>
    )
    case 'turret': return (
      <svg viewBox="0 0 24 16" {...s}><circle cx="12" cy="7" r="5" fill="none" stroke={color} strokeWidth="1.5"/><circle cx="12" cy="7" r="2" fill={color} opacity="0.5"/><line x1="4" y1="14" x2="20" y2="14" stroke={color} strokeWidth="1.5"/></svg>
    )
    case 'ptz': return (
      <svg viewBox="0 0 24 16" {...s}><ellipse cx="10" cy="6" rx="7" ry="5" fill="none" stroke={color} strokeWidth="1.5"/><circle cx="14" cy="6" r="3" fill="none" stroke={color} strokeWidth="1.5"/><line x1="12" y1="11" x2="12" y2="15" stroke={color} strokeWidth="1.5"/><line x1="8" y1="15" x2="16" y2="15" stroke={color} strokeWidth="1.5"/></svg>
    )
    case 'fisheye': return (
      <svg viewBox="0 0 24 16" {...s}><circle cx="12" cy="8" r="7" fill="none" stroke={color} strokeWidth="1.5"/><circle cx="12" cy="8" r="3" fill="none" stroke={color} strokeWidth="1"/><circle cx="12" cy="8" r="1" fill={color}/></svg>
    )
    case 'covert': return (
      <svg viewBox="0 0 24 16" {...s}><rect x="8" y="3" width="8" height="10" rx="2" fill="none" stroke={color} strokeWidth="1.5"/><circle cx="12" cy="8" r="1.5" fill={color}/></svg>
    )
    case 'cube': return (
      <svg viewBox="0 0 24 16" {...s}><rect x="5" y="2" width="14" height="12" rx="2" fill="none" stroke={color} strokeWidth="1.5"/><circle cx="12" cy="8" r="3" fill="none" stroke={color} strokeWidth="1"/></svg>
    )
    case 'multisensor': return (
      <svg viewBox="0 0 24 16" {...s}><circle cx="7" cy="5" r="3" fill="none" stroke={color} strokeWidth="1.2"/><circle cx="17" cy="5" r="3" fill="none" stroke={color} strokeWidth="1.2"/><circle cx="7" cy="12" r="3" fill="none" stroke={color} strokeWidth="1.2"/><circle cx="17" cy="12" r="3" fill="none" stroke={color} strokeWidth="1.2"/></svg>
    )
    default: return null
  }
}

const ACCENT = '#2b8fce'
const HEADER_BG = '#2b8fce'

export function DeviceCatalogModal({ category, onClose, onSelect }: DeviceCatalogModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DeviceSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null)
  const [selectedForm, setSelectedForm] = useState('')
  const [selectedRes, setSelectedRes] = useState('')

  const [irRange, setIrRange] = useState([0, 500])
  const [haovRange, setHaovRange] = useState([1, 360])
  const [hoveredModel, setHoveredModel] = useState<DeviceSearchResult | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const doFetch = useCallback(async (q: string) => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '500' })
    if (category) params.set('category', category)
    if (q.trim()) params.set('q', q.trim())
    try {
      const res = await fetch(`/api/org/device-library/search?${params}`)
      if (res.ok) { const json = await res.json(); setResults(json.results ?? []) }
    } finally { setLoading(false) }
  }, [category])

  useEffect(() => {
    setQuery('')
    setSelectedBrand(null)
    setSelectedForm('')
    setSelectedRes('')
    setResults([])
    doFetch('')
    setTimeout(() => searchRef.current?.focus(), 100)
  }, [category, doFetch])

  function handleSearch(val: string) {
    setQuery(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => doFetch(val), 300)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  /* Generic camera placement */
  function handleSelectGeneric() {
    const generic: DeviceSearchResult = {
      id: 'generic_camera',
      vendor: 'Generic',
      model: 'Generic Camera',
      category: category || 'cctv',
      subcategory: 'dome',
      resolution: '2MP',
      ndaa_compliant: false,
      partnumber: null,
      wattage: null,
      poe_standard: null,
      manufacturer_id: null,
      specs: {
        fov_angle: 90,
        target_distance: 30,
        focal_length: 2.8,
        sensor_width: 5.6,
        resolution_w: 1920,
        resolution_h: 1080,
        install_height: 9,
      },
    }
    onSelect(generic)
  }

  // Derived
  const brands = useMemo(() => {
    const set = new Set<string>()
    for (const r of results) { if (r.vendor) set.add(r.vendor) }
    return [...set].sort()
  }, [results])

  const filteredModels = useMemo(() => {
    return results.filter((r) => {
      if (selectedBrand && r.vendor !== selectedBrand) return false
      if (selectedForm) {
        const sub = (r.subcategory || '').toLowerCase()
        if (selectedForm === 'multisensor') {
          if (!sub.includes('multisensor') && !sub.includes('multi')) return false
        } else if (selectedForm === 'covert') {
          if (!sub.includes('covert') && !sub.includes('hidden') && !sub.includes('pinhole')) return false
        } else if (selectedForm === 'cube') {
          if (!sub.includes('cube') && !sub.includes('compact')) return false
        } else if (!sub.includes(selectedForm)) return false
      }
      if (selectedRes) {
        const specs = (r.specs ?? {}) as Record<string, unknown>
        const res = ((specs.resolution as string) || r.resolution || '').toLowerCase()
        if (selectedRes === '2mp') { if (!res.includes('2mp') && !res.includes('1080')) return false }
        else if (selectedRes === '4mp') { if (!res.includes('4mp')) return false }
        else if (selectedRes === '5mp') { if (!res.includes('5mp')) return false }
        else if (selectedRes === '8mp') { if (!res.includes('8mp') && !res.includes('4k') && !res.includes('uhd')) return false }
        else if (selectedRes === '12mp+') { if (!res.includes('12mp') && !res.includes('16mp') && !res.includes('32mp')) return false }
      }
      return true
    })
  }, [results, selectedBrand, selectedForm, selectedRes])

  const activeInfo = hoveredModel || (filteredModels.length === 1 ? filteredModels[0] : null)

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: 24,
    }} onClick={onClose}>
      <div style={{
        backgroundColor: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8,
        width: '100%', maxWidth: 1100, height: '90vh', maxHeight: 800,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 80px rgba(0,0,0,0.6)', overflow: 'hidden',
      }} onClick={(e) => e.stopPropagation()}>

        {/* ═══ HEADER ═══ */}
        <div style={{
          background: HEADER_BG, padding: '10px 20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>Select Camera Model</span>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
            width: 28, height: 28, borderRadius: 4, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={16} />
          </button>
        </div>

        {/* ═══ FILTERS BAR ═══ */}
        <div style={{
          padding: '12px 20px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', flexDirection: 'column', gap: 10, background: C.bgSurface,
        }}>
          {/* Row 1: Search + Generic Camera */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: C.textMuted }} />
              <input ref={searchRef} value={query} onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search..."
                style={{
                  width: '100%', background: C.bg, border: `1px solid ${C.border}`,
                  borderRadius: 4, padding: '7px 10px 7px 32px', fontSize: 13, color: C.text,
                  outline: 'none', fontFamily: 'inherit',
                }} />
            </div>

            {/* Generic Camera button */}
            <button onClick={handleSelectGeneric} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', fontSize: 11, fontWeight: 600,
              background: '#374151', border: `1px solid ${C.border}`,
              borderRadius: 4, color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}>
              <Cctv size={13} />
              Select Generic Camera
            </button>
          </div>

          {/* Row 2: Resolution + Form Type Icons + Range Sliders */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Resolution filter */}
            <div style={{ display: 'flex', gap: 0, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: C.textDim, marginRight: 6, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>Resolution</span>
              <div style={{ display: 'flex', gap: 0 }}>
                {[
                  { id: '', label: 'Any' },
                  { id: '2mp', label: '2MP' },
                  { id: '4mp', label: '4MP' },
                  { id: '5mp', label: '5MP' },
                  { id: '8mp', label: '4K' },
                  { id: '12mp+', label: '12MP+' },
                ].map((r, i, arr) => {
                  const active = selectedRes === r.id
                  return (
                    <button key={r.id} onClick={() => setSelectedRes(active ? '' : r.id)}
                      style={{
                        padding: '3px 8px', fontSize: 10,
                        border: `1px solid ${active ? ACCENT : C.border}`,
                        borderRadius: i === 0 ? '3px 0 0 3px' : i === arr.length - 1 ? '0 3px 3px 0' : 0,
                        marginLeft: i > 0 ? -1 : 0,
                        cursor: 'pointer', fontFamily: 'inherit',
                        background: active ? `${ACCENT}20` : C.bgActive,
                        color: active ? ACCENT : C.textMuted,
                        fontWeight: active ? 600 : 400,
                      }}>{r.label}</button>
                  )
                })}
              </div>
            </div>

            {/* Form type icons */}
            <div style={{ display: 'flex', gap: 0, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: C.textDim, marginRight: 6, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>Form</span>
              <div style={{ display: 'flex', gap: 2 }}>
                {FORM_TYPES.map((ft) => {
                  const active = selectedForm === ft.id
                  return (
                    <button key={ft.id} onClick={() => setSelectedForm(active ? '' : ft.id)}
                      title={ft.label}
                      style={{
                        padding: '3px 8px', fontSize: 10,
                        border: `1px solid ${active ? ACCENT : C.border}`,
                        borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit',
                        background: active ? `${ACCENT}20` : C.bgActive,
                        color: active ? ACCENT : C.textMuted,
                        fontWeight: active ? 600 : 400,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                        minWidth: ft.id ? 42 : 32,
                      }}>
                      {ft.id ? <FormIcon type={ft.id} color={active ? ACCENT : C.textMuted} /> : null}
                      <span>{ft.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* IR Max Range */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: C.textDim, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, whiteSpace: 'nowrap' }}>IR Range</span>
              <input type="range" min={0} max={500} value={irRange[1]}
                onChange={(e) => setIrRange([0, Number(e.target.value)])}
                style={{ width: 80, accentColor: ACCENT }} />
              <span style={{ fontSize: 10, color: C.textMuted, whiteSpace: 'nowrap' }}>0–{irRange[1]}m</span>
            </div>

            {/* HAoV */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: C.textDim, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>HAoV</span>
              <input type="range" min={1} max={360} value={haovRange[1]}
                onChange={(e) => setHaovRange([1, Number(e.target.value)])}
                style={{ width: 80, accentColor: ACCENT }} />
              <span style={{ fontSize: 10, color: C.textMuted, whiteSpace: 'nowrap' }}>1°–{haovRange[1]}°</span>
            </div>
          </div>
        </div>

        {/* ═══ THREE-COLUMN BODY ═══ */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* ── BRANDS ── */}
          <div style={{ width: 200, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: '8px 12px', borderBottom: `1px solid ${C.border}`, fontSize: 11, fontWeight: 600, color: ACCENT, background: C.bgSurface }}>
              Brands
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {/* Recent + Favorites */}
              <BrandRow icon={<Clock size={12} />} label="Recent" active={false} onClick={() => {}} />
              <BrandRow icon={<Star size={12} style={{ color: '#eab308' }} />} label="Favorite" active={false} onClick={() => {}} starred />
              <div style={{ height: 1, background: C.border, margin: '2px 0' }} />
              <BrandRow label={`All Brands (${brands.length})`} active={!selectedBrand} onClick={() => setSelectedBrand(null)} />
              {brands.map((brand) => {
                const count = results.filter((r) => r.vendor === brand).length
                return (
                  <BrandRow key={brand} label={brand} count={count}
                    active={selectedBrand === brand}
                    onClick={() => setSelectedBrand(selectedBrand === brand ? null : brand)} />
                )
              })}
            </div>
          </div>

          {/* ── MODELS ── */}
          <div style={{ flex: 1, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '8px 12px', borderBottom: `1px solid ${C.border}`, fontSize: 11, fontWeight: 600, color: ACCENT, background: C.bgSurface }}>
              Models
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {loading ? (
                <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: C.textDim }}>Loading...</div>
              ) : filteredModels.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: C.textDim }}>No models match filters</div>
              ) : (
                filteredModels.map((item) => (
                  <ModelRow key={item.id} item={item}
                    onClick={() => onSelect(item)}
                    onHover={() => setHoveredModel(item)}
                    onLeave={() => setHoveredModel(null)} />
                ))
              )}
            </div>
          </div>

          {/* ── INFO PANEL ── */}
          <div style={{ width: 280, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: '8px 12px', borderBottom: `1px solid ${C.border}`, fontSize: 11, fontWeight: 600, color: ACCENT, background: C.bgSurface }}>
              Info
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 20, gap: 16, overflow: 'auto' }}>
              {activeInfo ? (
                /* Model detail view */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{activeInfo.model}</div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>{activeInfo.vendor}</div>
                  </div>
                  <div style={{ width: '100%', padding: 14, background: C.bg, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <InfoLine label="Category" value={activeInfo.subcategory?.replace(/_/g, ' ') || activeInfo.category} />
                    <InfoLine label="Resolution" value={activeInfo.resolution || 'N/A'} />
                    {activeInfo.specs && (
                      <>
                        {(activeInfo.specs as Record<string, unknown>).fov_angle && (
                          <InfoLine label="FOV Angle" value={`${(activeInfo.specs as Record<string, unknown>).fov_angle}°`} />
                        )}
                        {(activeInfo.specs as Record<string, unknown>).focal_length && (
                          <InfoLine label="Focal Length" value={`${(activeInfo.specs as Record<string, unknown>).focal_length}mm`} />
                        )}
                        {(activeInfo.specs as Record<string, unknown>).ir_range && (
                          <InfoLine label="IR Range" value={`${(activeInfo.specs as Record<string, unknown>).ir_range}m`} />
                        )}
                      </>
                    )}
                    <InfoLine label="NDAA" value={activeInfo.ndaa_compliant ? '✅ Compliant' : 'No'} />
                  </div>
                  <button onClick={() => onSelect(activeInfo)} style={{
                    width: '100%', padding: '8px 0', background: ACCENT, border: 'none',
                    borderRadius: 4, color: '#fff', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>Select This Camera</button>
                </div>
              ) : (
                /* Summary view */
                <>
                  <div style={{ textAlign: 'center', paddingTop: 20 }}>
                    <div style={{ fontSize: 13, color: C.textMuted }}>Choose from</div>
                    <div style={{ fontSize: 36, fontWeight: 700, color: C.text, lineHeight: 1.2 }}>{filteredModels.length.toLocaleString()}</div>
                    <div style={{ fontSize: 13, color: C.textMuted }}>cameras</div>
                  </div>
                  <div style={{ width: '100%', padding: 14, background: C.bg, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <InfoLine label="Brand" value={selectedBrand || 'Any'} />
                    <InfoLine label="Resolutions" value={selectedRes ? (selectedRes === '8mp' ? '4K/8MP' : selectedRes.toUpperCase()) : 'Any'} />
                    <InfoLine label="Form" value={selectedForm ? FORM_TYPES.find(f => f.id === selectedForm)?.label || 'Any' : 'Any'} />
                    <InfoLine label="IR Max Range" value={irRange[1] < 500 ? `0–${irRange[1]}m` : 'Any'} />
                    <InfoLine label="HAoV" value={haovRange[1] < 360 ? `1°–${haovRange[1]}°` : 'Any'} />

                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Toggle Button Pair ─── */
function ToggleBtn({ label, active, onClick, left, right }: { label: string; active: boolean; onClick: () => void; left?: boolean; right?: boolean }) {
  return (
    <button onClick={onClick}
      style={{
        padding: '4px 8px', fontSize: 10, border: 'none',
        borderRadius: left ? '3px 0 0 3px' : right ? '0 3px 3px 0' : 0,
        cursor: 'pointer', fontFamily: 'inherit', fontWeight: active ? 600 : 400,
        background: active ? ACCENT : C.bgActive, color: active ? '#fff' : C.textMuted,
      }}>{label}</button>
  )
}

/* ─── Brand Row ─── */
function BrandRow({ label, count, active, onClick, icon, starred }: {
  label: string; count?: number; active?: boolean; onClick: () => void; icon?: React.ReactNode; starred?: boolean
}) {
  return (
    <div onClick={onClick}
      style={{
        padding: '6px 12px', cursor: 'pointer', fontSize: 12,
        color: active ? ACCENT : C.text, fontWeight: active ? 600 : 400,
        background: active ? `${ACCENT}15` : 'transparent',
        borderLeft: active ? `2px solid ${ACCENT}` : '2px solid transparent',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6,
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = C.bgHover }}
      onMouseLeave={(e) => { e.currentTarget.style.background = active ? `${ACCENT}15` : 'transparent' }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon}
        {label}
      </span>
      {count != null && <span style={{ fontSize: 10, color: C.textDim }}>{count}</span>}
    </div>
  )
}

/* ─── Model Row ─── */
function ModelRow({ item, onClick, onHover, onLeave }: {
  item: DeviceSearchResult; onClick: () => void; onHover: () => void; onLeave: () => void
}) {
  const specs = (item.specs ?? {}) as Record<string, unknown>
  const res = (specs.resolution as string) || item.resolution || ''
  const fov = specs.fov_angle as string | undefined
  const form = (item.subcategory || '').replace(/_/g, ' ')

  return (
    <div onClick={onClick} onMouseEnter={onHover} onMouseLeave={onLeave}
      style={{
        padding: '8px 12px', cursor: 'pointer',
        borderBottom: `1px solid ${C.borderSubtle}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        transition: 'background 0.1s',
      }}
      onMouseOver={(e) => { e.currentTarget.style.background = C.bgHover }}
      onMouseOut={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 13, color: ACCENT, fontWeight: 500 }}>{item.model}</span>
        <span style={{ fontSize: 10, color: C.textDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.vendor} · {form}</span>
      </div>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
        {res && <Badge text={res} bg="rgba(59,130,246,0.12)" color={C.accent} />}
        {fov && <Badge text={`${fov}°`} bg="rgba(34,197,94,0.12)" color={C.green} />}
        {item.ndaa_compliant && (
          <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 2, border: `1px solid ${C.green}`, color: C.green }}>NDAA</span>
        )}
      </div>
    </div>
  )
}

function Badge({ text, bg, color }: { text: string; bg: string; color: string }) {
  return <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 3, background: bg, color }}>{text}</span>
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
      <span style={{ color: C.textMuted, fontWeight: 600 }}>{label}:</span>
      <span style={{ color: C.text }}>{value}</span>
    </div>
  )
}
