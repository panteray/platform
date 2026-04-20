'use client'
/**
 * DeviceGrid — DesignPro-style device browsing grid.
 *
 * Shared between the device library page (mode='browse') and
 * the canvas add-device modal (mode='select').
 *
 * Does not auto-load devices. User must enter a search query or
 * apply at least one filter before results are fetched.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Search, X, SlidersHorizontal, LayoutGrid, List, ShieldCheck, ShieldAlert,
  DoorOpen, Network as NetworkIcon, Volume2, Wind, HardDrive, Package,
  Trash2, Edit3, CheckSquare, Square,
} from 'lucide-react'
import type { DeviceSearchResult, DeviceElement } from '@/types/database'
import { DEVICE_CATEGORIES } from '@/types/enums'

/* ───────── Form Factor Icons — PNG images from Hanwha ───────── */

const FORM_ICON_MAP: Record<string, string> = {
  box: '/icons/cctv/box.png',
  highresolutionbox: '/icons/cctv/hi-res_box.png',
  bullet: '/icons/cctv/bullet.png',
  thermalbullet: '/icons/cctv/thermal.png',
  dome: '/icons/cctv/dome.png',
  minidome: '/icons/cctv/mini_dome.png',
  turret: '/icons/cctv/turret.png',
  ptz: '/icons/cctv/PTZ.png',
  irptz: '/icons/cctv/PTZ.png',
  fisheye: '/icons/cctv/fisheye.png',
  covert: '/icons/cctv/covert.png',
  multisensor: '/icons/cctv/multisensor.png',
  multidirectional: '/icons/cctv/multisensor.png',
  corner: '/icons/cctv/corner.png',
  videointercom: '/icons/cctv/Intercom.png',
  modular: '/icons/cctv/modular.png',
  dualsensor: '/icons/cctv/dualsensor.png',
}

const CATEGORY_FALLBACK_ICON: Record<string, typeof DoorOpen> = {
  access_control: DoorOpen,
  network: NetworkIcon,
  av: Volume2,
  vape_environmental: Wind,
  servers_nvr: HardDrive,
  other: Package,
}

function FormIcon({ type, size = 20, category }: { type: string; size?: number; color?: string; category?: string }) {
  const key = type.toLowerCase().replace(/[\s_-]/g, '')
  const cctvSrc = FORM_ICON_MAP[key]
  if (category === 'cctv' || (!category && cctvSrc)) {
    const src = cctvSrc || FORM_ICON_MAP.box
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={type} width={size} height={size} style={{ objectFit: 'contain' }} />
    )
  }
  const Fallback = (category && CATEGORY_FALLBACK_ICON[category]) || Package
  return <Fallback size={size} />
}

/* ───────── CCTV form factor list ───────── */

const CCTV_FORM_FACTORS = [
  'Box', 'Bullet', 'Dome', 'Fisheye', 'PTZ', 'Turret', 'Covert',
  'Video Intercom', 'High Resolution Box', 'Corner', 'IR PTZ',
  'Modular', 'Multisensor', 'Thermal Bullet', 'Mini Dome',
] as const

/* ───────── Props ───────── */

export interface DeviceGridProps {
  category?: string
  onSelect?: (device: DeviceSearchResult) => void
  mode: 'browse' | 'select'
  onBrowseClick?: (id: string) => void
  /** Called after bulk delete so parent can refresh */
  onBulkChanged?: () => void
  /** If false, hide bulk toolbar, per-card delete, and multi-select */
  canWrite?: boolean
}

const ACCENT = '#2b8fce'

/* ───────── Component ───────── */

export function DeviceGrid({ category: externalCategory, onSelect, mode, onBrowseClick, onBulkChanged, canWrite = true }: DeviceGridProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DeviceSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeCategory, setActiveCategory] = useState(externalCategory || 'cctv')
  const [selectedForms, setSelectedForms] = useState<Set<string>>(new Set())
  const [selectedSubcategory, setSelectedSubcategory] = useState('')
  const [selectedRes, setSelectedRes] = useState('')
  const [selectedVendor, setSelectedVendor] = useState('')
  const [selectedNdaa, setSelectedNdaa] = useState<'' | 'true' | 'false'>('')
  const [selectedUl, setSelectedUl] = useState<'' | 'true' | 'false'>('')
  const [showFilters, setShowFilters] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [distinctResolutions, setDistinctResolutions] = useState<string[]>([])
  const [manufacturers, setManufacturers] = useState<string[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [elements, setElements] = useState<DeviceElement[]>([])
  const [selectedElementId, setSelectedElementId] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const filterRef = useRef<HTMLDivElement>(null)

  const category = externalCategory || activeCategory
  const isCctv = category === 'cctv'

  // Load reference data once
  useEffect(() => {
    fetch('/api/org/device-library/distinct-resolutions')
      .then(r => r.json())
      .then(j => setDistinctResolutions(j.resolutions ?? []))
      .catch((e) => { console.error('[DeviceGrid] Failed to load resolutions:', e) })
    fetch('/api/org/device-library/manufacturers-list')
      .then(r => r.json())
      .then(j => setManufacturers(j.manufacturers ?? []))
      .catch((e) => { console.error('[DeviceGrid] Failed to load manufacturers:', e) })
    fetch('/api/org/device-library/elements')
      .then(r => r.json())
      .then(j => setElements(j.elements ?? []))
      .catch((e) => { console.error('[DeviceGrid] Failed to load elements:', e) })
  }, [])

  // Active-filter count (excluding category tab)
  const activeFilterCount =
    (selectedVendor ? 1 : 0) +
    selectedForms.size +
    (selectedSubcategory ? 1 : 0) +
    (selectedElementId ? 1 : 0) +
    (selectedRes ? 1 : 0) +
    (selectedNdaa ? 1 : 0) +
    (selectedUl ? 1 : 0)

  const hasQuery = query.trim().length > 0
  const shouldFetch = hasQuery || activeFilterCount > 0

  // Fetch
  const doFetch = useCallback(async (q: string, cat: string, elemId: string) => {
    setLoading(true)
    try {
      const allResults: DeviceSearchResult[] = []
      let offset = 0
      const batchSize = 1000
      while (true) {
        const params = new URLSearchParams({ limit: String(batchSize), offset: String(offset) })
        if (cat) params.set('category', cat)
        if (elemId) params.set('element_id', elemId)
        if (q.trim()) params.set('q', q.trim())
        const res = await fetch(`/api/org/device-library/search?${params}`)
        if (!res.ok) break
        const json = await res.json()
        const batch = json.results ?? []
        allResults.push(...batch)
        if (batch.length < batchSize) break
        offset += batchSize
      }
      setResults(allResults)
    } finally { setLoading(false) }
  }, [])

  // Re-fetch only when user has entered search OR applied a filter
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!shouldFetch) {
      setResults([])
      setLoading(false)
      return
    }
    timerRef.current = setTimeout(() => doFetch(query, category, selectedElementId), 300)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query, category, selectedElementId, doFetch, shouldFetch])

  // Clear selection when filters/category change
  useEffect(() => { setSelectedIds(new Set()) }, [category, query])

  useEffect(() => { setTimeout(() => searchRef.current?.focus(), 100) }, [])

  useEffect(() => {
    if (!showFilters) return
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilters(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showFilters])

  // Client-side filter
  const filtered = useMemo(() => {
    return results.filter(r => {
      if (selectedVendor && r.vendor !== selectedVendor) return false
      if (selectedForms.size > 0) {
        const sub = (r.subcategory || r.form || '').toLowerCase()
        let matched = false
        for (const f of selectedForms) {
          const fLow = f.toLowerCase().replace(/[\s_-]/g, '')
          if (sub.replace(/[\s_-]/g, '').includes(fLow)) { matched = true; break }
        }
        if (!matched) return false
      }
      if (selectedSubcategory) {
        const sub = (r.subcategory || r.form || '').toLowerCase()
        if (sub !== selectedSubcategory.toLowerCase()) return false
      }
      if (selectedRes) {
        const res = (r.resolution || '').toLowerCase()
        if (!res.includes(selectedRes.toLowerCase())) return false
      }
      if (selectedNdaa === 'true' && !r.ndaa_compliant) return false
      if (selectedNdaa === 'false' && r.ndaa_compliant) return false
      if (selectedUl === 'true' && !r.ul_listed) return false
      if (selectedUl === 'false' && r.ul_listed) return false
      return true
    })
  }, [results, selectedVendor, selectedForms, selectedSubcategory, selectedRes, selectedNdaa, selectedUl])

  // Distinct subcategories within current category/results (for non-CCTV)
  const distinctSubcategories = useMemo(() => {
    const s = new Set<string>()
    for (const r of results) {
      const v = (r.subcategory || r.form || '').trim()
      if (v) s.add(v)
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b))
  }, [results])

  // Group by form factor / subcategory for card grid
  const groups = useMemo(() => {
    const map = new Map<string, DeviceSearchResult[]>()
    for (const r of filtered) {
      const form = r.subcategory || r.form || 'Other'
      if (!map.has(form)) map.set(form, [])
      map.get(form)!.push(r)
    }
    return new Map([...map.entries()].sort((a, b) => a[0].localeCompare(b[0])))
  }, [filtered])

  function toggleForm(f: string) {
    setSelectedForms(prev => {
      const next = new Set(prev)
      if (next.has(f)) next.delete(f)
      else next.add(f)
      return next
    })
  }

  function clearFilters() {
    setSelectedVendor('')
    setSelectedForms(new Set())
    setSelectedSubcategory('')
    setSelectedElementId('')
    setSelectedRes('')
    setSelectedNdaa('')
    setSelectedUl('')
  }

  function handleCardClick(device: DeviceSearchResult) {
    if (mode === 'select' && onSelect) onSelect(device)
    else if (mode === 'browse' && onBrowseClick) onBrowseClick(device.id)
  }

  function toggleRow(id: string, e?: React.MouseEvent) {
    e?.stopPropagation()
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelectAllVisible() {
    if (selectedIds.size > 0 && selectedIds.size >= filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map(r => r.id)))
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return
    if (!confirm(`Delete ${selectedIds.size} device${selectedIds.size !== 1 ? 's' : ''}?`)) return
    setBulkBusy(true)
    try {
      const res = await fetch('/api/org/device-library/items/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      })
      if (res.ok) {
        setSelectedIds(new Set())
        doFetch(query, category, selectedElementId)
        onBulkChanged?.()
      } else {
        const j = await res.json().catch(() => ({}))
        alert(j.error ?? 'Bulk delete failed')
      }
    } finally { setBulkBusy(false) }
  }

  async function handleBulkChangeCategory(newCategory: string) {
    if (selectedIds.size === 0 || !newCategory) return
    if (!confirm(`Move ${selectedIds.size} device${selectedIds.size !== 1 ? 's' : ''} to ${newCategory}?`)) return
    setBulkBusy(true)
    try {
      const res = await fetch('/api/org/device-library/items/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), updates: { category: newCategory } }),
      })
      if (res.ok) {
        setSelectedIds(new Set())
        doFetch(query, category, selectedElementId)
        onBulkChanged?.()
      } else {
        const j = await res.json().catch(() => ({}))
        alert(j.error ?? 'Bulk update failed')
      }
    } finally { setBulkBusy(false) }
  }

  async function handleDeleteOne(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Delete this device?')) return
    try {
      const res = await fetch(`/api/org/device-library/items/${id}`, { method: 'DELETE' })
      if (res.ok) {
        doFetch(query, category, selectedElementId)
        onBulkChanged?.()
      } else {
        const j = await res.json().catch(() => ({}))
        alert(j.error ?? 'Delete failed')
      }
    } catch { /* ignore */ }
  }

  const anySelected = selectedIds.size > 0
  const showEmptyPrompt = !shouldFetch && !loading

  return (
    <div className="flex flex-col h-full font-['Inter','Segoe_UI',sans-serif]">
      {/* ═══ Category Tabs ═══ */}
      {!externalCategory && (
        <div className="flex gap-0 border-b border-border bg-background px-4 overflow-x-auto">
          {DEVICE_CATEGORIES.map(cat => {
            const active = activeCategory === cat.value
            return (
              <button key={cat.value}
                onClick={() => { setActiveCategory(cat.value); clearFilters() }}
                className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  active ? 'border-[#2b8fce] text-[#2b8fce]' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {cat.label}
              </button>
            )
          })}
        </div>
      )}

      {/* ═══ Search + Filter Bar ═══ */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            ref={searchRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search vendor, model, part number..."
            className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="relative" ref={filterRef}>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-sm font-medium transition-colors ${
              activeFilterCount > 0
                ? 'border-[#2b8fce] bg-[#2b8fce]/10 text-[#2b8fce]'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filter
            {activeFilterCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center h-5 w-5 rounded-full bg-[#2b8fce] text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>

          {showFilters && (
            <div className="absolute right-0 top-11 z-50 w-[420px] rounded-lg border border-border bg-background shadow-xl p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Filters</span>
                {activeFilterCount > 0 && (
                  <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground">
                    Clear all
                  </button>
                )}
              </div>

              {/* Manufacturer — always */}
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Manufacturer</p>
                <select
                  value={selectedVendor}
                  onChange={e => setSelectedVendor(e.target.value)}
                  className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
                >
                  <option value="">All Manufacturers</option>
                  {manufacturers.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              {/* CCTV: Form Factor icons */}
              {isCctv && (
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Form Factor</p>
                  <div className="flex flex-wrap gap-1.5">
                    {CCTV_FORM_FACTORS.map(f => {
                      const active = selectedForms.has(f)
                      return (
                        <button key={f}
                          onClick={() => toggleForm(f)}
                          title={f}
                          className={`inline-flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md border text-[9px] font-medium transition-colors min-w-[52px] ${
                            active
                              ? 'border-[#2b8fce] bg-[#2b8fce]/10 text-[#2b8fce]'
                              : 'border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <FormIcon type={f} size={18} color={active ? ACCENT : 'currentColor'} />
                          <span className="leading-tight text-center">{f.length > 10 ? f.split(' ').map(w => w[0]).join('') : f}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Non-CCTV: Element filter (schema-driven taxonomy) */}
              {!isCctv && (
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Element</p>
                  <select
                    value={selectedElementId}
                    onChange={e => setSelectedElementId(e.target.value)}
                    className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
                  >
                    <option value="">All Elements</option>
                    {elements.filter(el => el.category === category).map(el => (
                      <option key={el.id} value={el.id}>{el.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Non-CCTV: Subcategory dropdown, fed by current result set */}
              {!isCctv && (
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Subcategory</p>
                  <select
                    value={selectedSubcategory}
                    onChange={e => setSelectedSubcategory(e.target.value)}
                    className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground disabled:opacity-50"
                    disabled={distinctSubcategories.length === 0}
                  >
                    <option value="">
                      {distinctSubcategories.length === 0 ? 'Search to load subcategories' : 'All Subcategories'}
                    </option>
                    {distinctSubcategories.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}

              {/* Resolution — CCTV only */}
              {isCctv && (
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Resolution</p>
                  <select
                    value={selectedRes}
                    onChange={e => setSelectedRes(e.target.value)}
                    className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
                  >
                    <option value="">All Resolutions</option>
                    {distinctResolutions.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              )}

              {/* UL — only for lock elements */}
              {(() => {
                const el = elements.find(e => e.id === selectedElementId)
                const isLock = el && /lock/i.test(el.name)
                if (!isLock) return null
                return (
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">UL Listing</p>
                    <div className="flex gap-1.5">
                      {[{ value: '', label: 'Any' }, { value: 'true', label: 'Listed' }, { value: 'false', label: 'Not Listed' }].map(opt => {
                        const active = selectedUl === opt.value
                        return (
                          <button key={opt.value}
                            onClick={() => setSelectedUl(opt.value as '' | 'true' | 'false')}
                            className={`px-3 py-1 rounded-md border text-xs font-medium transition-colors ${
                              active ? 'border-[#2b8fce] bg-[#2b8fce]/10 text-[#2b8fce]' : 'border-border text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              <button
                onClick={() => setShowFilters(false)}
                className="w-full h-8 rounded-md bg-[#2b8fce] text-white text-xs font-semibold hover:bg-[#2b8fce]/90 transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>

        {mode === 'browse' && (
          <div className="flex border border-border rounded-md overflow-hidden">
            <button onClick={() => setViewMode('grid')}
              className={`p-1.5 ${viewMode === 'grid' ? 'bg-[#2b8fce]/10 text-[#2b8fce]' : 'text-muted-foreground hover:text-foreground'}`}
              title="Card grid"><LayoutGrid className="h-4 w-4" /></button>
            <button onClick={() => setViewMode('list')}
              className={`p-1.5 border-l border-border ${viewMode === 'list' ? 'bg-[#2b8fce]/10 text-[#2b8fce]' : 'text-muted-foreground hover:text-foreground'}`}
              title="Table list"><List className="h-4 w-4" /></button>
          </div>
        )}

        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {shouldFetch ? `${filtered.length.toLocaleString()} device${filtered.length !== 1 ? 's' : ''}` : 'Search or filter to load'}
        </span>
      </div>

      {/* ═══ Active Filter Chips ═══ */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-4 py-2 border-b border-border bg-muted/30">
          {selectedVendor && (
            <Chip label={selectedVendor} onRemove={() => setSelectedVendor('')} />
          )}
          {Array.from(selectedForms).map(f => (
            <Chip key={f} label={f} onRemove={() => toggleForm(f)} />
          ))}
          {selectedElementId && (
            <Chip
              label={elements.find(el => el.id === selectedElementId)?.name ?? 'Element'}
              onRemove={() => setSelectedElementId('')}
            />
          )}
          {selectedSubcategory && <Chip label={selectedSubcategory} onRemove={() => setSelectedSubcategory('')} />}
          {selectedRes && <Chip label={selectedRes} onRemove={() => setSelectedRes('')} />}
          {selectedNdaa && <Chip label={`NDAA: ${selectedNdaa === 'true' ? 'Compliant' : 'Non-compliant'}`} onRemove={() => setSelectedNdaa('')} />}
          {selectedUl && <Chip label={`UL: ${selectedUl === 'true' ? 'Listed' : 'Not Listed'}`} onRemove={() => setSelectedUl('')} />}
          <button onClick={clearFilters} className="text-[10px] text-muted-foreground hover:text-foreground ml-1">Clear all</button>
        </div>
      )}

      {/* ═══ Bulk Action Bar ═══ */}
      {mode === 'browse' && canWrite && anySelected && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-[#2b8fce]/10">
          <button onClick={toggleSelectAllVisible}
            className="inline-flex items-center gap-1 text-xs font-medium text-foreground hover:text-[#2b8fce]">
            {selectedIds.size >= filtered.length ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
            {selectedIds.size} selected
          </button>
          <div className="h-4 w-px bg-border mx-1" />
          <select
            defaultValue=""
            onChange={e => { const v = e.target.value; e.target.value = ''; if (v) handleBulkChangeCategory(v) }}
            disabled={bulkBusy}
            className="h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground disabled:opacity-50"
          >
            <option value="">Change category…</option>
            {DEVICE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <button onClick={handleBulkDelete} disabled={bulkBusy}
            className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-red-500/40 bg-red-500/10 text-xs font-medium text-red-500 hover:bg-red-500/20 disabled:opacity-50">
            <Trash2 className="h-3.5 w-3.5" />
            {bulkBusy ? 'Working…' : 'Delete'}
          </button>
          <button onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground">Clear</button>
        </div>
      )}

      {/* ═══ Content ═══ */}
      <div className="flex-1 overflow-y-auto">
        {showEmptyPrompt ? (
          <div className="p-12 text-center">
            <Search className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground">Search or apply filters to browse devices</p>
            <p className="text-xs text-muted-foreground mt-1.5">
              Enter a vendor, model, or part number — or open Filter to narrow by subcategory, NDAA, UL, and more.
            </p>
          </div>
        ) : loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading devices...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <Search className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium text-muted-foreground">No devices found</p>
            <p className="text-xs text-muted-foreground mt-1">Try adjusting your search or filters</p>
          </div>
        ) : viewMode === 'grid' || mode === 'select' ? (
          <div className="p-4 space-y-6">
            {Array.from(groups.entries()).map(([formFactor, devices]) => (
              <div key={formFactor}>
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <FormIcon type={formFactor} size={16} color="currentColor" category={category} />
                  {formFactor.replace(/_/g, ' ')}
                  <span className="text-xs font-normal text-muted-foreground">({devices.length})</span>
                </h3>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
                  {devices.map(device => (
                    <DeviceCard
                      key={device.id}
                      device={device}
                      onClick={() => handleCardClick(device)}
                      selected={selectedIds.has(device.id)}
                      onToggleSelect={(e) => toggleRow(device.id, e)}
                      onDelete={mode === 'browse' && canWrite ? (e) => handleDeleteOne(device.id, e) : undefined}
                      showSelect={mode === 'browse' && canWrite}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {mode === 'browse' && canWrite && (
                  <th className="px-3 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selectedIds.size >= filtered.length}
                      onChange={toggleSelectAllVisible}
                      className="accent-[#2b8fce]"
                    />
                  </th>
                )}
                <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Manufacturer</th>
                <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Model</th>
                <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Part #</th>
                <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Form</th>
                {isCctv && (
                  <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Resolution</th>
                )}
                <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">NDAA</th>
                <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">UL</th>
                {mode === 'browse' && canWrite && <th className="px-3 py-2 w-10"></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(device => (
                <tr key={device.id}
                  onClick={() => handleCardClick(device)}
                  className={`border-b border-border/50 hover:bg-muted/50 transition-colors cursor-pointer ${selectedIds.has(device.id) ? 'bg-[#2b8fce]/5' : ''}`}
                >
                  {mode === 'browse' && canWrite && (
                    <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(device.id)}
                        onChange={(e) => toggleRow(device.id, e as unknown as React.MouseEvent)}
                        className="accent-[#2b8fce]"
                      />
                    </td>
                  )}
                  <td className="px-3 py-2 font-medium text-foreground">{device.vendor}</td>
                  <td className="px-3 py-2 text-foreground">{device.model}</td>
                  <td className="px-3 py-2 text-muted-foreground font-mono text-xs">{device.partnumber ?? '-'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{device.subcategory || device.form || '-'}</td>
                  {isCctv && <td className="px-3 py-2 text-muted-foreground">{device.resolution ?? '-'}</td>}
                  <td className="px-3 py-2">
                    {device.ndaa_compliant ? (
                      <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                    ) : device.ndaa_compliant === false ? (
                      <ShieldAlert className="h-3.5 w-3.5 text-red-500" />
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {device.ul_listed ? (
                      <span className="inline-flex items-center rounded border border-amber-500/50 px-1.5 py-0.5 text-[9px] font-bold leading-none text-amber-600">
                        {device.ul_listing_code ?? 'UL'}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </td>
                  {mode === 'browse' && canWrite && (
                    <td className="px-3 py-2 text-right" onClick={e => e.stopPropagation()}>
                      <button onClick={(e) => handleDeleteOne(device.id, e)}
                        className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500"
                        title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

/* ───────── Chip ───────── */

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#2b8fce]/10 border border-[#2b8fce]/30 px-2 py-0.5 text-[10px] font-medium text-[#2b8fce]">
      {label}
      <button onClick={onRemove} className="hover:text-foreground"><X className="h-3 w-3" /></button>
    </span>
  )
}

/* ───────── Device Card ───────── */

function DeviceCard({
  device, onClick, selected, onToggleSelect, onDelete, showSelect,
}: {
  device: DeviceSearchResult
  onClick: () => void
  selected: boolean
  onToggleSelect: (e: React.MouseEvent) => void
  onDelete?: (e: React.MouseEvent) => void
  showSelect: boolean
}) {
  const form = device.subcategory || device.form || 'Other'
  const res = device.resolution || ''

  return (
    <div
      onClick={onClick}
      className={`group relative flex flex-col items-center gap-1.5 p-3 rounded-lg border bg-background cursor-pointer transition-all ${
        selected ? 'border-[#2b8fce] bg-[#2b8fce]/5' : 'border-border hover:border-[#2b8fce]/50 hover:bg-[#2b8fce]/5'
      }`}
    >
      {showSelect && (
        <button
          onClick={onToggleSelect}
          className={`absolute left-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded border transition-all ${
            selected ? 'border-[#2b8fce] bg-[#2b8fce] text-white' : 'border-border bg-background opacity-0 group-hover:opacity-100'
          }`}
          title={selected ? 'Unselect' : 'Select'}
        >
          {selected ? <CheckSquare className="h-3 w-3" /> : <Square className="h-3 w-3" />}
        </button>
      )}
      {onDelete && (
        <button
          onClick={onDelete}
          className="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-all"
          title="Delete"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
      <div className="h-14 w-full flex items-center justify-center text-muted-foreground group-hover:text-[#2b8fce] transition-colors">
        <FormIcon type={form} size={40} color="currentColor" category={device.category} />
      </div>
      <p className="text-[11px] font-medium text-foreground text-center leading-tight truncate w-full">
        {device.model}
      </p>
      <p className="text-[9px] text-muted-foreground text-center leading-tight truncate w-full">
        {res && <span>{res} · </span>}
        {device.vendor}
      </p>
      <div className="flex items-center gap-1">
        {device.ndaa_compliant && (
          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded border border-green-500/50 text-green-500 leading-none">NDAA</span>
        )}
        {device.ul_listed && (
          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded border border-amber-500/50 text-amber-600 leading-none">
            {device.ul_listing_code ?? 'UL'}
          </span>
        )}
      </div>
    </div>
  )
}

/* silence unused lint for imported but conditionally used icon */
export const _unused = Edit3
