'use client'
/**
 * DeviceLibraryModal — IPVM/Hanwha hybrid 3-column device selector.
 *
 * Layout: Brands (left) → Models (middle) → Info (right)
 * Filters: Search, Form Factor icons, Resolution dropdown, Indoor/Outdoor, AI/Non-AI
 * Favorites: persisted to localStorage, float to top of lists
 * Custom device form accessible via "+ Add Custom" button.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { X, Plus, Search, Star, Cctv, ChevronDown } from 'lucide-react'
import { C } from './constants'
import type { DeviceSearchResult } from '@/types/database'

const ACCENT = '#6d28d9'

/* ─── Form factor icons (reuse existing PNGs from Hanwha set) ─── */
const FORM_FACTORS = [
  { id: 'box', label: 'Box', icon: '/icons/cctv/box.png' },
  { id: 'bullet', label: 'Bullet', icon: '/icons/cctv/bullet.png' },
  { id: 'dome', label: 'Dome', icon: '/icons/cctv/dome.png' },
  { id: 'fisheye', label: 'Fisheye', icon: '/icons/cctv/fisheye.png' },
  { id: 'ptz', label: 'PTZ', icon: '/icons/cctv/PTZ.png' },
  { id: 'turret', label: 'Turret', icon: '/icons/cctv/turret.png' },
  { id: 'covert', label: 'Covert', icon: '/icons/cctv/covert.png' },
  { id: 'multisensor', label: 'Multi', icon: '/icons/cctv/multisensor.png' },
  { id: 'minidome', label: 'Mini Dome', icon: '/icons/cctv/mini_dome.png' },
  { id: 'corner', label: 'Corner', icon: '/icons/cctv/corner.png' },
] as const

/* ─── Custom device form factor options by category ─── */
const FORM_TYPES_MAP: Record<string, { id: string; label: string }[]> = {
  cctv: [
    { id: 'box', label: 'Box' }, { id: 'bullet', label: 'Bullet' },
    { id: 'dome', label: 'Dome' }, { id: 'turret', label: 'Turret' },
    { id: 'ptz', label: 'PTZ' }, { id: 'fisheye', label: 'Fisheye' },
    { id: 'multisensor', label: 'Multi' }, { id: 'covert', label: 'Covert' },
  ],
  access_control: [
    { id: 'reader', label: 'Reader' }, { id: 'controller', label: 'Controller' },
    { id: 'maglock', label: 'Maglock' }, { id: 'strike', label: 'Strike' },
    { id: 'rex', label: 'REX' },
  ],
  network: [
    { id: 'switch', label: 'Switch' }, { id: 'router', label: 'Router' },
    { id: 'wap', label: 'WAP' }, { id: 'firewall', label: 'Firewall' },
  ],
  av: [
    { id: 'display', label: 'Display' }, { id: 'speaker', label: 'Speaker' },
    { id: 'microphone', label: 'Mic' }, { id: 'amplifier', label: 'Amp' },
  ],
}

/* ─── Favorites localStorage key ─── */
const FAV_KEY = 'panteray_device_favorites'
function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAV_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch { return new Set() }
}
function saveFavorites(ids: Set<string>) {
  localStorage.setItem(FAV_KEY, JSON.stringify([...ids]))
}

/* ─── Form factor icon for info panel ─── */
function formIconSrc(form: string): string {
  const key = (form || '').toLowerCase().replace(/[\s_-]/g, '')
  const match = FORM_FACTORS.find(f => key.includes(f.id))
  return match?.icon || '/icons/cctv/dome.png'
}

/* ─── Props ─── */
interface DeviceLibraryModalProps {
  category: string
  onClose: () => void
  onSelect: (device: DeviceSearchResult) => void
}

/* ─── Component ─── */
export function DeviceLibraryModal({ category, onClose, onSelect }: DeviceLibraryModalProps) {
  // Custom device form state
  const [isAdding, setIsAdding] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const FORM_TYPES = FORM_TYPES_MAP[category] || FORM_TYPES_MAP.cctv
  const [addForm, setAddForm] = useState({
    vendor: '', model: '', subcategory: FORM_TYPES[0]?.id || 'other', resolution: '4MP',
    focal_length: 2.8, sensor_width: 5.14, fov_angle: 90, ir_range: 30, ndaa_compliant: false,
  })

  // 3-column browser state
  const [allDevices, setAllDevices] = useState<DeviceSearchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null)
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [activeFormFactors, setActiveFormFactors] = useState<Set<string>>(new Set())
  const [selectedResolution, setSelectedResolution] = useState('')
  const [envFilter, setEnvFilter] = useState<'all' | 'indoor' | 'outdoor'>('all')
  const [aiFilter, setAiFilter] = useState<'all' | 'ai' | 'non-ai'>('all')
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const searchRef = useRef<HTMLInputElement>(null)

  // Load favorites from localStorage on mount
  useEffect(() => { setFavorites(loadFavorites()) }, [])

  // Fetch all devices for the active category
  useEffect(() => {
    setLoading(true)
    const fetchAll = async () => {
      const all: DeviceSearchResult[] = []
      let offset = 0
      const batch = 1000
      while (true) {
        const params = new URLSearchParams({ limit: String(batch), offset: String(offset) })
        if (category) params.set('category', category)
        const res = await fetch(`/api/org/device-library/search?${params}`)
        if (!res.ok) break
        const json = await res.json()
        const items = json.results ?? []
        all.push(...items)
        if (items.length < batch) break
        offset += batch
      }
      setAllDevices(all)
      setLoading(false)
    }
    fetchAll()
  }, [category])

  // Focus search on mount
  useEffect(() => { setTimeout(() => searchRef.current?.focus(), 150) }, [])

  // ── Client-side filtering ──
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return allDevices.filter(d => {
      // Search: vendor, model, partnumber
      if (q) {
        const haystack = `${d.vendor} ${d.model} ${d.partnumber || ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      // Form factor
      if (activeFormFactors.size > 0) {
        const devForm = (d.subcategory || d.form || '').toLowerCase().replace(/[\s_-]/g, '')
        let matched = false
        for (const f of activeFormFactors) {
          if (devForm.includes(f)) { matched = true; break }
        }
        if (!matched) return false
      }
      // Resolution
      if (selectedResolution) {
        const res = (d.resolution || '').toLowerCase()
        if (!res.includes(selectedResolution.toLowerCase())) return false
      }
      // Indoor/Outdoor
      if (envFilter !== 'all') {
        const env = (d.environment || '').toLowerCase()
        if (envFilter === 'indoor' && !env.includes('indoor')) return false
        if (envFilter === 'outdoor' && !env.includes('outdoor')) return false
      }
      // AI
      if (aiFilter !== 'all') {
        const model = (d.model || '').toLowerCase()
        const hasAi = model.includes(' ai ') || model.includes(' ai-') || model.endsWith(' ai') || model.startsWith('ai ')
          || (d.specs as Record<string, unknown> | null)?.ai === true
        if (aiFilter === 'ai' && !hasAi) return false
        if (aiFilter === 'non-ai' && hasAi) return false
      }
      return true
    })
  }, [allDevices, searchQuery, activeFormFactors, selectedResolution, envFilter, aiFilter])

  // ── Brands list (from filtered results) ──
  const brands = useMemo(() => {
    const countMap = new Map<string, number>()
    for (const d of filtered) {
      countMap.set(d.vendor, (countMap.get(d.vendor) || 0) + 1)
    }
    const arr = [...countMap.entries()].map(([name, count]) => ({ name, count }))
    // Favorites first, then alphabetical
    const favBrands = new Set<string>()
    for (const d of allDevices) {
      if (favorites.has(d.id)) favBrands.add(d.vendor)
    }
    arr.sort((a, b) => {
      const aFav = favBrands.has(a.name) ? 0 : 1
      const bFav = favBrands.has(b.name) ? 0 : 1
      if (aFav !== bFav) return aFav - bFav
      return a.name.localeCompare(b.name)
    })
    return { list: arr, favBrands }
  }, [filtered, favorites, allDevices])

  // ── Models list (filtered by selected brand) ──
  const models = useMemo(() => {
    let list = filtered
    if (selectedBrand) {
      list = list.filter(d => d.vendor === selectedBrand)
    }
    // Favorites first, then alphabetical by model
    const sorted = [...list].sort((a, b) => {
      const aFav = favorites.has(a.id) ? 0 : 1
      const bFav = favorites.has(b.id) ? 0 : 1
      if (aFav !== bFav) return aFav - bFav
      return a.model.localeCompare(b.model)
    })
    return sorted
  }, [filtered, selectedBrand, favorites])

  // ── Selected device for info panel ──
  const selectedDevice = useMemo(() =>
    allDevices.find(d => d.id === selectedDeviceId) ?? null
  , [allDevices, selectedDeviceId])

  // ── Distinct resolutions for dropdown ──
  const distinctResolutions = useMemo(() => {
    const set = new Set<string>()
    for (const d of allDevices) {
      if (d.resolution) set.add(d.resolution)
    }
    return [...set].sort((a, b) => {
      // Sort numerically where possible (2MP < 4MP < 8MP)
      const aNum = parseFloat(a)
      const bNum = parseFloat(b)
      if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum
      return a.localeCompare(b)
    })
  }, [allDevices])

  // ── Toggle favorite ──
  const toggleFavorite = useCallback((id: string) => {
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveFavorites(next)
      return next
    })
  }, [])

  // ── Toggle form factor filter ──
  const toggleFormFactor = useCallback((id: string) => {
    setActiveFormFactors(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // ── Custom device submit ──
  async function handleAddDevice(e: React.FormEvent) {
    e.preventDefault()
    if (!addForm.vendor || !addForm.model) return alert('Vendor and Model are required.')
    setSubmitting(true)
    try {
      const res = await fetch('/api/org/device-library/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category, vendor: addForm.vendor, model: addForm.model,
          subcategory: addForm.subcategory,
          resolution: category === 'cctv' ? addForm.resolution : null,
          ndaa_compliant: addForm.ndaa_compliant, fps: category === 'cctv' ? 30 : null,
          wattage: 15, poe_standard: 'PoE+',
          specs: category === 'cctv' ? {
            focal_length: Number(addForm.focal_length), sensor_width: Number(addForm.sensor_width),
            fov_angle: Number(addForm.fov_angle), ir_range: Number(addForm.ir_range),
          } : {},
        }),
      })
      if (!res.ok) throw new Error('Failed to create device')
      const json = await res.json()
      onSelect(json.item)
    } catch {
      alert('Error creating custom device')
    } finally { setSubmitting(false) }
  }

  /* ─── Shared styles ─── */
  const chipStyle = (active: boolean) => ({
    padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
    border: `1px solid ${active ? ACCENT : C.border}`,
    background: active ? ACCENT : 'transparent',
    color: active ? '#fff' : C.textMuted,
    cursor: 'pointer' as const,
    transition: 'all 0.15s',
  })

  const inputStyle = {
    padding: '8px 12px', background: C.bg, border: `1px solid ${C.border}`,
    borderRadius: 4, color: C.text, fontFamily: 'Inter, sans-serif', fontSize: 13,
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 10,
          width: '100%', maxWidth: 1100, height: '85vh', maxHeight: 820,
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 25px 80px rgba(0,0,0,0.6)', overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ═══ Header ═══ */}
        <div style={{
          padding: '12px 20px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Cctv size={18} color={ACCENT} />
            <span style={{ color: C.text, fontSize: 15, fontWeight: 700, fontFamily: 'Inter, sans-serif' }}>
              {isAdding ? 'Add Custom Device' : 'Select Camera Model'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {!isAdding ? (
              <button onClick={() => setIsAdding(true)} style={{
                background: 'transparent', border: `1px solid ${C.border}`, color: C.text,
                padding: '5px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'Inter, sans-serif',
              }}>
                <Plus size={13} /> Add Custom
              </button>
            ) : (
              <button onClick={() => setIsAdding(false)} style={{
                background: 'transparent', border: `1px solid ${C.border}`, color: C.textMuted,
                padding: '5px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                fontFamily: 'Inter, sans-serif',
              }}>Back to Browser</button>
            )}
            <button onClick={onClose} style={{
              background: 'transparent', border: 'none', color: C.textMuted,
              width: 28, height: 28, borderRadius: 6, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {isAdding ? (
          /* ═══ Add Custom Device Form (preserved from original) ═══ */
          <div style={{ flex: 1, padding: 30, overflow: 'auto', background: C.bgPanel }}>
            <form onSubmit={handleAddDevice} style={{ maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: C.textDim }}>
                  Vendor (Brand) *
                  <input required value={addForm.vendor} onChange={e => setAddForm({ ...addForm, vendor: e.target.value })} style={inputStyle} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: C.textDim }}>
                  Model *
                  <input required value={addForm.model} onChange={e => setAddForm({ ...addForm, model: e.target.value })} style={inputStyle} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: C.textDim }}>
                  Form Factor
                  <select value={addForm.subcategory} onChange={e => setAddForm({ ...addForm, subcategory: e.target.value })}
                    style={{ ...inputStyle, fontFamily: 'inherit' }}>
                    {FORM_TYPES.map(ft => <option key={ft.id} value={ft.id}>{ft.label}</option>)}
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: C.textDim }}>
                  Resolution
                  <input value={addForm.resolution} onChange={e => setAddForm({ ...addForm, resolution: e.target.value })}
                    placeholder="e.g. 4MP, 4K, 1080p" style={inputStyle} />
                </label>
              </div>
              {category === 'cctv' && (
                <>
                  <div style={{ fontSize: 14, fontWeight: 600, color: ACCENT, marginTop: 10, borderBottom: `1px solid ${C.borderSubtle}`, paddingBottom: 8 }}>Optical Specifications (DORI)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                    {[
                      { label: 'Focal Length (mm)', key: 'focal_length', step: '0.1' },
                      { label: 'Sensor Width (mm)', key: 'sensor_width', step: '0.1' },
                      { label: 'Max FOV Angle (°)', key: 'fov_angle', step: '1' },
                      { label: 'IR Range (m)', key: 'ir_range', step: '1' },
                    ].map(f => (
                      <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: C.textDim }}>
                        {f.label}
                        <input type="number" step={f.step} required
                          value={(addForm as Record<string, unknown>)[f.key] as number}
                          onChange={e => setAddForm({ ...addForm, [f.key]: Number(e.target.value) })}
                          style={inputStyle} />
                      </label>
                    ))}
                  </div>
                </>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600, color: C.text, marginTop: 10 }}>
                <input type="checkbox" checked={addForm.ndaa_compliant} onChange={e => setAddForm({ ...addForm, ndaa_compliant: e.target.checked })}
                  style={{ width: 16, height: 16, accentColor: '#22c55e' }} />
                NDAA Compliant
              </label>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                <button type="submit" disabled={submitting} style={{
                  padding: '10px 24px', background: ACCENT, color: '#fff', border: 'none',
                  borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: submitting ? 'wait' : 'pointer', fontFamily: 'Inter, sans-serif',
                }}>
                  {submitting ? 'Saving...' : 'Add Device & Place on Map'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* ═══ 3-Column IPVM Browser ═══ */
          <>
            {/* ── Search + Filter Row ── */}
            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Search */}
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.textDim }} />
                <input
                  ref={searchRef}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search brand, model, part number..."
                  style={{
                    ...inputStyle, width: '100%', paddingLeft: 32, fontSize: 13,
                  }}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: C.textDim,
                  }}><X size={14} /></button>
                )}
              </div>

              {/* Filters row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {/* Form factor icons */}
                {FORM_FACTORS.map(ff => (
                  <button
                    key={ff.id}
                    onClick={() => toggleFormFactor(ff.id)}
                    title={ff.label}
                    style={{
                      width: 38, height: 38, borderRadius: 6, cursor: 'pointer',
                      border: activeFormFactors.has(ff.id) ? `2px solid ${ACCENT}` : `1px solid ${C.border}`,
                      background: activeFormFactors.has(ff.id) ? 'rgba(109,40,217,0.1)' : 'transparent',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      padding: 2, transition: 'all 0.15s',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ff.icon} alt={ff.label} width={20} height={20} style={{ objectFit: 'contain' }} />
                    <span style={{ fontSize: 7, color: C.textDim, lineHeight: 1, marginTop: 1 }}>{ff.label}</span>
                  </button>
                ))}

                <div style={{ width: 1, height: 28, background: C.border, margin: '0 4px' }} />

                {/* Resolution dropdown */}
                <div style={{ position: 'relative' }}>
                  <select
                    value={selectedResolution}
                    onChange={e => setSelectedResolution(e.target.value)}
                    style={{
                      ...inputStyle, fontSize: 11, padding: '4px 24px 4px 8px', borderRadius: 6,
                      appearance: 'none', minWidth: 90, cursor: 'pointer',
                    }}
                  >
                    <option value="">All Res</option>
                    {distinctResolutions.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <ChevronDown size={12} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: C.textDim }} />
                </div>

                <div style={{ width: 1, height: 28, background: C.border, margin: '0 4px' }} />

                {/* Indoor/Outdoor chips */}
                {(['indoor', 'outdoor'] as const).map(v => (
                  <button key={v} onClick={() => setEnvFilter(envFilter === v ? 'all' : v)}
                    style={chipStyle(envFilter === v)}>
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </button>
                ))}

                <div style={{ width: 1, height: 28, background: C.border, margin: '0 4px' }} />

                {/* AI chips */}
                {([['ai', 'AI'], ['non-ai', 'Non-AI']] as const).map(([val, lbl]) => (
                  <button key={val} onClick={() => setAiFilter(aiFilter === val ? 'all' : val)}
                    style={chipStyle(aiFilter === val)}>
                    {lbl}
                  </button>
                ))}

                {/* Active filter count */}
                {(activeFormFactors.size > 0 || selectedResolution || envFilter !== 'all' || aiFilter !== 'all') && (
                  <button onClick={() => { setActiveFormFactors(new Set()); setSelectedResolution(''); setEnvFilter('all'); setAiFilter('all') }}
                    style={{ ...chipStyle(false), color: ACCENT, borderColor: ACCENT, fontSize: 10 }}>
                    Clear filters
                  </button>
                )}
              </div>
            </div>

            {/* ── 3 Columns ── */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
              {/* ── Brands Column ── */}
              <div style={{
                width: 200, borderRight: `1px solid ${C.border}`, overflow: 'auto',
                display: 'flex', flexDirection: 'column',
              }}>
                <div style={{
                  padding: '8px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                  color: C.textDim, letterSpacing: 1, borderBottom: `1px solid ${C.borderSubtle}`,
                }}>
                  Brands ({brands.list.length})
                </div>
                {/* All Brands option */}
                <button
                  onClick={() => setSelectedBrand(null)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '7px 12px', border: 'none', cursor: 'pointer', width: '100%',
                    textAlign: 'left', fontSize: 12, fontWeight: selectedBrand === null ? 700 : 400,
                    fontFamily: 'Inter, sans-serif',
                    background: selectedBrand === null ? `${ACCENT}15` : 'transparent',
                    color: selectedBrand === null ? ACCENT : C.text,
                    borderLeft: selectedBrand === null ? `3px solid ${ACCENT}` : '3px solid transparent',
                  }}
                >
                  <span>All Brands</span>
                  <span style={{ fontSize: 10, color: C.textDim }}>{filtered.length}</span>
                </button>
                {loading ? (
                  <div style={{ padding: 20, textAlign: 'center', color: C.textDim, fontSize: 12 }}>Loading...</div>
                ) : (
                  brands.list.map(b => (
                    <button
                      key={b.name}
                      onClick={() => setSelectedBrand(b.name === selectedBrand ? null : b.name)}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '6px 12px', border: 'none', cursor: 'pointer', width: '100%',
                        textAlign: 'left', fontSize: 12, fontWeight: selectedBrand === b.name ? 600 : 400,
                        fontFamily: 'Inter, sans-serif',
                        background: selectedBrand === b.name ? `${ACCENT}15` : 'transparent',
                        color: selectedBrand === b.name ? ACCENT : C.text,
                        borderLeft: selectedBrand === b.name ? `3px solid ${ACCENT}` : '3px solid transparent',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {brands.favBrands.has(b.name) && <Star size={10} color="#eab308" fill="#eab308" />}
                        {b.name}
                      </span>
                      <span style={{ fontSize: 10, color: C.textDim }}>{b.count}</span>
                    </button>
                  ))
                )}
              </div>

              {/* ── Models Column ── */}
              <div style={{
                width: 260, borderRight: `1px solid ${C.border}`, overflow: 'auto',
                display: 'flex', flexDirection: 'column',
              }}>
                <div style={{
                  padding: '8px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                  color: C.textDim, letterSpacing: 1, borderBottom: `1px solid ${C.borderSubtle}`,
                }}>
                  Models ({models.length})
                </div>
                {models.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: C.textDim, fontSize: 12 }}>
                    {loading ? 'Loading...' : 'No models match filters'}
                  </div>
                ) : (
                  models.map(d => (
                    <button
                      key={d.id}
                      onClick={() => setSelectedDeviceId(d.id)}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '6px 12px', border: 'none', cursor: 'pointer', width: '100%',
                        textAlign: 'left', fontSize: 12, fontFamily: 'Inter, sans-serif',
                        fontWeight: selectedDeviceId === d.id ? 600 : 400,
                        background: selectedDeviceId === d.id ? `${ACCENT}15` : 'transparent',
                        color: selectedDeviceId === d.id ? ACCENT : C.text,
                        borderLeft: selectedDeviceId === d.id ? `3px solid ${ACCENT}` : '3px solid transparent',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                        {favorites.has(d.id) && <Star size={10} color="#eab308" fill="#eab308" style={{ flexShrink: 0 }} />}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.model}</span>
                      </span>
                      {d.resolution && (
                        <span style={{
                          fontSize: 9, color: C.textDim, background: C.bgHover,
                          padding: '1px 5px', borderRadius: 3, flexShrink: 0, marginLeft: 4,
                        }}>{d.resolution}</span>
                      )}
                    </button>
                  ))
                )}
              </div>

              {/* ── Info Panel ── */}
              <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
                {selectedDevice ? (
                  <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Thumbnail + title */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={formIconSrc(selectedDevice.subcategory || selectedDevice.form || '')}
                        alt={selectedDevice.model}
                        width={64} height={64}
                        style={{ objectFit: 'contain', background: C.bgHover, borderRadius: 8, padding: 8 }}
                      />
                      <div>
                        <div style={{ fontSize: 13, color: C.textDim, fontWeight: 500, fontFamily: 'Inter, sans-serif' }}>
                          {selectedDevice.vendor}
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: 'Inter, sans-serif' }}>
                          {selectedDevice.model}
                        </div>
                        {selectedDevice.partnumber && (
                          <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>
                            Part #: {selectedDevice.partnumber}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Specs table */}
                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0,
                      border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden',
                    }}>
                      {[
                        { label: 'Form', value: selectedDevice.subcategory || selectedDevice.form },
                        { label: 'Resolution', value: selectedDevice.resolution },
                        { label: 'Focal Length', value: selectedDevice.focal_length ? `${selectedDevice.focal_length}mm` : null },
                        { label: 'AOV', value: selectedDevice.aov ? `${selectedDevice.aov}°` : null },
                        { label: 'Imager Count', value: selectedDevice.imager_count },
                        { label: 'Multi-Imager Type', value: selectedDevice.multi_imager_type },
                        { label: 'IR', value: selectedDevice.ir },
                        { label: 'Environment', value: selectedDevice.environment },
                        { label: 'Focal Type', value: selectedDevice.focal_type },
                        { label: 'NDAA', value: selectedDevice.ndaa_compliant ? '✓ Compliant' : 'Non-compliant' },
                      ].filter(s => s.value != null && s.value !== '').map((s, i) => (
                        <div key={s.label} style={{
                          padding: '8px 12px', fontSize: 12, fontFamily: 'Inter, sans-serif',
                          borderBottom: `1px solid ${C.borderSubtle}`,
                          background: i % 2 === 0 ? 'transparent' : C.bgHover,
                          display: 'flex', justifyContent: 'space-between',
                        }}>
                          <span style={{ color: C.textDim, fontWeight: 500 }}>{s.label}</span>
                          <span style={{ color: C.text, fontWeight: 600 }}>{String(s.value)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Favorite button */}
                    <button
                      onClick={() => toggleFavorite(selectedDevice.id)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        padding: '8px 16px', borderRadius: 6, cursor: 'pointer',
                        border: `1px solid ${favorites.has(selectedDevice.id) ? '#eab308' : C.border}`,
                        background: favorites.has(selectedDevice.id) ? 'rgba(234,179,8,0.1)' : 'transparent',
                        color: favorites.has(selectedDevice.id) ? '#eab308' : C.textMuted,
                        fontSize: 13, fontWeight: 600, fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      <Star size={14} fill={favorites.has(selectedDevice.id) ? '#eab308' : 'none'} />
                      {favorites.has(selectedDevice.id) ? 'Favorited' : 'Add to Favorites'}
                    </button>

                    {/* Select button */}
                    <button
                      onClick={() => { onSelect(selectedDevice); onClose() }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        padding: '12px 24px', borderRadius: 8, cursor: 'pointer',
                        border: 'none', background: ACCENT, color: '#fff',
                        fontSize: 14, fontWeight: 700, fontFamily: 'Inter, sans-serif',
                        boxShadow: `0 2px 8px ${ACCENT}40`,
                      }}
                    >
                      <Cctv size={16} />
                      Select This Camera
                    </button>
                  </div>
                ) : (
                  /* Empty state */
                  <div style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    color: C.textDim, gap: 8, padding: 40,
                  }}>
                    <Cctv size={40} strokeWidth={1} />
                    <div style={{ fontSize: 14, fontWeight: 500, fontFamily: 'Inter, sans-serif' }}>
                      Select a model to view details
                    </div>
                    <div style={{ fontSize: 11, fontFamily: 'Inter, sans-serif' }}>
                      {filtered.length} devices available
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
