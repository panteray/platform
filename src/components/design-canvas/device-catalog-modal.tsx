'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { X, Search } from 'lucide-react'
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
  { id: 'dome', label: 'Dome' },
  { id: 'turret', label: 'Turret' },
  { id: 'ptz', label: 'PTZ' },
  { id: 'fisheye', label: 'Fisheye' },
  { id: 'multisensor', label: 'Multi' },
]

const ACCENT = '#2b8fce'

export function DeviceCatalogModal({ category, onClose, onSelect }: DeviceCatalogModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DeviceSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null)
  const [selectedForm, setSelectedForm] = useState('')
  const [ndaaOnly, setNdaaOnly] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const doFetch = useCallback(async (q: string, ndaa: boolean) => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '200' })
    if (category) params.set('category', category)
    if (q.trim()) params.set('q', q.trim())
    if (ndaa) params.set('ndaa_compliant', 'true')
    try {
      const res = await fetch(`/api/org/device-library/search?${params}`)
      if (res.ok) { const json = await res.json(); setResults(json.results ?? []) }
    } finally { setLoading(false) }
  }, [category])

  useEffect(() => {
    setQuery('')
    setSelectedBrand(null)
    setSelectedForm('')
    setResults([])
    doFetch('', ndaaOnly)
    setTimeout(() => searchRef.current?.focus(), 100)
  }, [category, doFetch, ndaaOnly])

  function handleSearch(val: string) {
    setQuery(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => doFetch(val, ndaaOnly), 300)
  }

  function toggleNdaa() {
    const next = !ndaaOnly
    setNdaaOnly(next)
    doFetch(query, next)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

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
        } else if (!sub.includes(selectedForm)) return false
      }
      return true
    })
  }, [results, selectedBrand, selectedForm])

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

        {/* Header */}
        <div style={{
          background: ACCENT, padding: '10px 20px',
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

        {/* Search + Filters */}
        <div style={{
          padding: '12px 20px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', flexDirection: 'column', gap: 10, background: C.bgSurface,
        }}>
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
            <div style={{ display: 'flex', gap: 0, fontSize: 11 }}>
              <span style={{ color: C.textMuted, marginRight: 8, alignSelf: 'center' }}>NDAA:</span>
              <button onClick={toggleNdaa}
                style={{
                  padding: '5px 10px', fontSize: 11, border: 'none', borderRadius: '4px 0 0 4px',
                  cursor: 'pointer', fontFamily: 'inherit',
                  background: !ndaaOnly ? ACCENT : C.bgActive, color: !ndaaOnly ? '#fff' : C.textMuted,
                }}>All Cameras</button>
              <button onClick={toggleNdaa}
                style={{
                  padding: '5px 10px', fontSize: 11, border: 'none', borderRadius: '0 4px 4px 0',
                  cursor: 'pointer', fontFamily: 'inherit',
                  background: ndaaOnly ? ACCENT : C.bgActive, color: ndaaOnly ? '#fff' : C.textMuted,
                }}>Only NDAA</button>
            </div>
          </div>

          {/* Form type filters */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: C.textDim, marginRight: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Form</span>
            {FORM_TYPES.map((ft) => {
              const active = selectedForm === ft.id
              return (
                <button key={ft.id} onClick={() => setSelectedForm(active ? '' : ft.id)}
                  style={{
                    padding: '4px 12px', fontSize: 11,
                    border: `1px solid ${active ? ACCENT : C.border}`,
                    borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
                    background: active ? `${ACCENT}20` : C.bgActive,
                    color: active ? ACCENT : C.textMuted,
                  }}>{ft.label}</button>
              )
            })}
          </div>
        </div>

        {/* Three-Column Body */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Brands */}
          <div style={{ width: 200, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: '8px 12px', borderBottom: `1px solid ${C.border}`, fontSize: 11, fontWeight: 600, color: ACCENT, background: C.bgSurface }}>
              Brands
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
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

          {/* Models */}
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
                  <ModelRow key={item.id} item={item} onClick={() => onSelect(item)} />
                ))
              )}
            </div>
          </div>

          {/* Info */}
          <div style={{ width: 280, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: '8px 12px', borderBottom: `1px solid ${C.border}`, fontSize: 11, fontWeight: 600, color: ACCENT, background: C.bgSurface }}>
              Info
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: C.textMuted }}>Choose from</div>
                <div style={{ fontSize: 36, fontWeight: 700, color: C.text, lineHeight: 1.2 }}>{filteredModels.length.toLocaleString()}</div>
                <div style={{ fontSize: 13, color: C.textMuted }}>cameras</div>
              </div>
              <div style={{ width: '100%', padding: 16, background: C.bg, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <InfoLine label="Brand" value={selectedBrand || 'Any'} />
                <InfoLine label="Form" value={selectedForm ? FORM_TYPES.find(f => f.id === selectedForm)?.label || 'Any' : 'Any'} />
                <InfoLine label="NDAA" value={ndaaOnly ? 'Only NDAA' : 'Any'} />
                {query && <InfoLine label="Search" value={`"${query}"`} />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function BrandRow({ label, count, active, onClick }: { label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick}
      style={{
        padding: '6px 12px', cursor: 'pointer', fontSize: 12,
        color: active ? ACCENT : C.text, fontWeight: active ? 600 : 400,
        background: active ? `${ACCENT}15` : 'transparent',
        borderLeft: active ? `2px solid ${ACCENT}` : '2px solid transparent',
        display: 'flex', justifyContent: 'space-between',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = C.bgHover }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = active ? `${ACCENT}15` : 'transparent' }}
    >
      <span>{label}</span>
      {count != null && <span style={{ fontSize: 10, color: C.textDim }}>{count}</span>}
    </div>
  )
}

function ModelRow({ item, onClick }: { item: DeviceSearchResult; onClick: () => void }) {
  const specs = (item.specs ?? {}) as Record<string, unknown>
  const res = (specs.resolution as string) || item.resolution || ''
  const fov = specs.fov_angle as string | undefined
  const form = (item.subcategory || '').replace(/_/g, ' ')

  return (
    <div onClick={onClick}
      style={{
        padding: '8px 12px', cursor: 'pointer',
        borderBottom: `1px solid ${C.borderSubtle}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = C.bgHover }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
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
