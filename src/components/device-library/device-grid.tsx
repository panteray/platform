'use client'
/**
 * DeviceGrid — DesignPro-style device browsing grid.
 *
 * Shared between the device library page (mode='browse') and
 * the canvas add-device modal (mode='select').
 *
 * Card grid grouped by form factor, filter popover with SVG form
 * icons, resolution dropdown from unfiltered data, search.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Search, X, SlidersHorizontal, LayoutGrid, List, ShieldCheck, ShieldAlert } from 'lucide-react'
import type { DeviceSearchResult } from '@/types/database'
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

function FormIcon({ type, size = 20 }: { type: string; size?: number; color?: string }) {
  const key = type.toLowerCase().replace(/[\s_-]/g, '')
  const src = FORM_ICON_MAP[key] || FORM_ICON_MAP.box
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={type}
      width={size}
      height={size}
      style={{ objectFit: 'contain' }}
    />
  )
}

/* ───────── Form factor list ───────── */

const FORM_FACTORS = [
  'Box', 'Bullet', 'Dome', 'Fisheye', 'PTZ', 'Turret', 'Covert',
  'Video Intercom', 'High Resolution Box', 'Corner', 'IR PTZ',
  'Modular', 'Multisensor', 'Thermal Bullet', 'Mini Dome',
] as const

/* ───────── Props ───────── */

export interface DeviceGridProps {
  /** Pre-filter by category (e.g. 'cctv'). If not set, shows category tabs. */
  category?: string
  /** Called when user picks a device */
  onSelect?: (device: DeviceSearchResult) => void
  /** 'browse' = library page (click opens drawer), 'select' = canvas modal (click selects device) */
  mode: 'browse' | 'select'
  /** Called when a device card is clicked in browse mode to show details */
  onBrowseClick?: (id: string) => void
}

/* ───────── Accent ───────── */

const ACCENT = '#2b8fce'

/* ───────── Component ───────── */

export function DeviceGrid({ category: externalCategory, onSelect, mode, onBrowseClick }: DeviceGridProps) {
  // State
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DeviceSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeCategory, setActiveCategory] = useState(externalCategory || 'cctv')
  const [selectedForms, setSelectedForms] = useState<Set<string>>(new Set())
  const [selectedRes, setSelectedRes] = useState('')
  const [selectedVendor, setSelectedVendor] = useState('')
  const [selectedNdaa, setSelectedNdaa] = useState<'' | 'true' | 'false'>('')
  const [selectedUl, setSelectedUl] = useState<'' | 'true' | 'false'>('')
  const [showFilters, setShowFilters] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [distinctResolutions, setDistinctResolutions] = useState<string[]>([])
  const [manufacturers, setManufacturers] = useState<string[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const filterRef = useRef<HTMLDivElement>(null)

  // Use external category if provided (canvas modal passes this)
  const category = externalCategory || activeCategory

  // Fetch distinct resolutions + manufacturers once (unfiltered)
  useEffect(() => {
    fetch('/api/org/device-library/distinct-resolutions')
      .then(r => r.json())
      .then(j => setDistinctResolutions(j.resolutions ?? []))
      .catch((e) => { console.error('[DeviceGrid] Failed to load resolutions:', e) })
    fetch('/api/org/device-library/manufacturers-list')
      .then(r => r.json())
      .then(j => setManufacturers(j.manufacturers ?? []))
      .catch((e) => { console.error('[DeviceGrid] Failed to load manufacturers:', e) })
  }, [])

  // Fetch results
  const doFetch = useCallback(async (q: string, cat: string) => {
    setLoading(true)
    try {
      const allResults: DeviceSearchResult[] = []
      let offset = 0
      const batchSize = 1000
      while (true) {
        const params = new URLSearchParams({ limit: String(batchSize), offset: String(offset) })
        if (cat) params.set('category', cat)
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

  // Re-fetch on category or search change
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => doFetch(query, category), 300)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query, category, doFetch])

  // Focus search on mount
  useEffect(() => {
    setTimeout(() => searchRef.current?.focus(), 100)
  }, [])

  // Close filter popover on outside click
  useEffect(() => {
    if (!showFilters) return
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilters(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showFilters])

  // Debounced search
  function handleSearch(val: string) {
    setQuery(val)
  }

  // Client-side filtering (vendor + form factor + resolution + NDAA)
  const filtered = useMemo(() => {
    return results.filter(r => {
      // Manufacturer
      if (selectedVendor && r.vendor !== selectedVendor) return false
      // Form factor
      if (selectedForms.size > 0) {
        const sub = (r.subcategory || r.form || '').toLowerCase()
        let matched = false
        for (const f of selectedForms) {
          const fLow = f.toLowerCase().replace(/[\s_-]/g, '')
          if (sub.replace(/[\s_-]/g, '').includes(fLow)) { matched = true; break }
        }
        if (!matched) return false
      }
      // Resolution
      if (selectedRes) {
        const res = (r.resolution || '').toLowerCase()
        if (!res.includes(selectedRes.toLowerCase())) return false
      }
      // NDAA
      if (selectedNdaa === 'true' && !r.ndaa_compliant) return false
      if (selectedNdaa === 'false' && r.ndaa_compliant) return false
      if (selectedUl === 'true' && !r.ul_listed) return false
      if (selectedUl === 'false' && r.ul_listed) return false
      return true
    })
  }, [results, selectedVendor, selectedForms, selectedRes, selectedNdaa, selectedUl])

  // Group by form factor for card grid
  const groups = useMemo(() => {
    const map = new Map<string, DeviceSearchResult[]>()
    for (const r of filtered) {
      const form = r.subcategory || r.form || 'Other'
      if (!map.has(form)) map.set(form, [])
      map.get(form)!.push(r)
    }
    // Sort groups alphabetically
    return new Map([...map.entries()].sort((a, b) => a[0].localeCompare(b[0])))
  }, [filtered])

  // Active filter count
  const activeFilterCount = (selectedVendor ? 1 : 0) + selectedForms.size + (selectedRes ? 1 : 0) + (selectedNdaa ? 1 : 0) + (selectedUl ? 1 : 0)

  // Toggle form factor
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
    setSelectedRes('')
    setSelectedNdaa('')
    setSelectedUl('')
  }

  function handleCardClick(device: DeviceSearchResult) {
    if (mode === 'select' && onSelect) {
      onSelect(device)
    } else if (mode === 'browse' && onBrowseClick) {
      onBrowseClick(device.id)
    }
  }

  return (
    <div className="flex flex-col h-full font-['Inter','Segoe_UI',sans-serif]">
      {/* ═══ Category Tabs (only when no external category) ═══ */}
      {!externalCategory && (
        <div className="flex gap-0 border-b border-border bg-background px-4">
          {DEVICE_CATEGORIES.map(cat => {
            const active = activeCategory === cat.value
            return (
              <button key={cat.value}
                onClick={() => { setActiveCategory(cat.value); setSelectedForms(new Set()); setSelectedRes(''); setSelectedNdaa('') }}
                className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                  active
                    ? 'border-[#2b8fce] text-[#2b8fce]'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
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
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            ref={searchRef}
            value={query}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search vendor, model, part number..."
            className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter button */}
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

          {/* ── Filter Popover ── */}
          {showFilters && (
            <div className="absolute right-0 top-11 z-50 w-[420px] rounded-lg border border-border bg-background shadow-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Filters</span>
                {activeFilterCount > 0 && (
                  <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground">
                    Clear all
                  </button>
                )}
              </div>

              {/* Manufacturer */}
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Manufacturer</p>
                <select
                  value={selectedVendor}
                  onChange={e => setSelectedVendor(e.target.value)}
                  className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
                >
                  <option value="">All Manufacturers</option>
                  {manufacturers.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Form Factor Icons */}
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Form Factor</p>
                <div className="flex flex-wrap gap-1.5">
                  {FORM_FACTORS.map(f => {
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

              {/* Resolution */}
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Resolution</p>
                <select
                  value={selectedRes}
                  onChange={e => setSelectedRes(e.target.value)}
                  className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
                >
                  <option value="">All Resolutions</option>
                  {distinctResolutions.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* NDAA */}
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">NDAA Compliance</p>
                <div className="flex gap-1.5">
                  {[
                    { value: '', label: 'Any' },
                    { value: 'true', label: 'Compliant' },
                    { value: 'false', label: 'Non-compliant' },
                  ].map(opt => {
                    const active = selectedNdaa === opt.value
                    return (
                      <button key={opt.value}
                        onClick={() => setSelectedNdaa(opt.value as '' | 'true' | 'false')}
                        className={`px-3 py-1 rounded-md border text-xs font-medium transition-colors ${
                          active
                            ? 'border-[#2b8fce] bg-[#2b8fce]/10 text-[#2b8fce]'
                            : 'border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* UL Listing */}
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">UL Listing</p>
                <div className="flex gap-1.5">
                  {[
                    { value: '', label: 'Any' },
                    { value: 'true', label: 'Listed' },
                    { value: 'false', label: 'Not Listed' },
                  ].map(opt => {
                    const active = selectedUl === opt.value
                    return (
                      <button key={opt.value}
                        onClick={() => setSelectedUl(opt.value as '' | 'true' | 'false')}
                        className={`px-3 py-1 rounded-md border text-xs font-medium transition-colors ${
                          active
                            ? 'border-[#2b8fce] bg-[#2b8fce]/10 text-[#2b8fce]'
                            : 'border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <button
                onClick={() => setShowFilters(false)}
                className="w-full h-8 rounded-md bg-[#2b8fce] text-white text-xs font-semibold hover:bg-[#2b8fce]/90 transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>

        {/* View toggle (browse mode only) */}
        {mode === 'browse' && (
          <div className="flex border border-border rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 ${viewMode === 'grid' ? 'bg-[#2b8fce]/10 text-[#2b8fce]' : 'text-muted-foreground hover:text-foreground'}`}
              title="Card grid"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 border-l border-border ${viewMode === 'list' ? 'bg-[#2b8fce]/10 text-[#2b8fce]' : 'text-muted-foreground hover:text-foreground'}`}
              title="Table list"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Count */}
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {filtered.length.toLocaleString()} device{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ═══ Active Filter Chips ═══ */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-4 py-2 border-b border-border bg-muted/30">
          {selectedVendor && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#2b8fce]/10 border border-[#2b8fce]/30 px-2 py-0.5 text-[10px] font-medium text-[#2b8fce]">
              {selectedVendor}
              <button onClick={() => setSelectedVendor('')} className="hover:text-foreground"><X className="h-3 w-3" /></button>
            </span>
          )}
          {Array.from(selectedForms).map(f => (
            <span key={f} className="inline-flex items-center gap-1 rounded-full bg-[#2b8fce]/10 border border-[#2b8fce]/30 px-2 py-0.5 text-[10px] font-medium text-[#2b8fce]">
              {f}
              <button onClick={() => toggleForm(f)} className="hover:text-foreground"><X className="h-3 w-3" /></button>
            </span>
          ))}
          {selectedRes && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#2b8fce]/10 border border-[#2b8fce]/30 px-2 py-0.5 text-[10px] font-medium text-[#2b8fce]">
              {selectedRes}
              <button onClick={() => setSelectedRes('')} className="hover:text-foreground"><X className="h-3 w-3" /></button>
            </span>
          )}
          {selectedNdaa && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#2b8fce]/10 border border-[#2b8fce]/30 px-2 py-0.5 text-[10px] font-medium text-[#2b8fce]">
              NDAA: {selectedNdaa === 'true' ? 'Compliant' : 'Non-compliant'}
              <button onClick={() => setSelectedNdaa('')} className="hover:text-foreground"><X className="h-3 w-3" /></button>
            </span>
          )}
          {selectedUl && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#2b8fce]/10 border border-[#2b8fce]/30 px-2 py-0.5 text-[10px] font-medium text-[#2b8fce]">
              UL: {selectedUl === 'true' ? 'Listed' : 'Not Listed'}
              <button onClick={() => setSelectedUl('')} className="hover:text-foreground"><X className="h-3 w-3" /></button>
            </span>
          )}
          <button onClick={clearFilters} className="text-[10px] text-muted-foreground hover:text-foreground ml-1">
            Clear all
          </button>
        </div>
      )}

      {/* ═══ Content ═══ */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading devices...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <Search className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium text-muted-foreground">No devices found</p>
            <p className="text-xs text-muted-foreground mt-1">Try adjusting your search or filters</p>
          </div>
        ) : viewMode === 'grid' || mode === 'select' ? (
          /* ── Card Grid ── */
          <div className="p-4 space-y-6">
            {Array.from(groups.entries()).map(([formFactor, devices]) => (
              <div key={formFactor}>
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <FormIcon type={formFactor} size={16} color="currentColor" />
                  {formFactor.replace(/_/g, ' ')}
                  <span className="text-xs font-normal text-muted-foreground">({devices.length})</span>
                </h3>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
                  {devices.map(device => (
                    <DeviceCard key={device.id} device={device} onClick={() => handleCardClick(device)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ── Table List (browse mode only) ── */
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Manufacturer</th>
                <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Model</th>
                <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Part #</th>
                <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Form</th>
                <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Resolution</th>
                <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">NDAA</th>
                <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">UL</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(device => (
                <tr key={device.id}
                  onClick={() => handleCardClick(device)}
                  className="border-b border-border/50 hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <td className="px-3 py-2 font-medium text-foreground">{device.vendor}</td>
                  <td className="px-3 py-2 text-foreground">{device.model}</td>
                  <td className="px-3 py-2 text-muted-foreground font-mono text-xs">{device.partnumber ?? '-'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{device.subcategory || device.form || '-'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{device.resolution ?? '-'}</td>
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

/* ───────── Device Card ───────── */

function DeviceCard({ device, onClick }: { device: DeviceSearchResult; onClick: () => void }) {
  const form = device.subcategory || device.form || 'Other'
  const res = device.resolution || ''

  return (
    <div
      onClick={onClick}
      className="group flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border bg-background hover:border-[#2b8fce]/50 hover:bg-[#2b8fce]/5 cursor-pointer transition-all"
    >
      {/* Form icon as placeholder for product image */}
      <div className="h-14 w-full flex items-center justify-center text-muted-foreground group-hover:text-[#2b8fce] transition-colors">
        <FormIcon type={form} size={40} color="currentColor" />
      </div>
      {/* Model */}
      <p className="text-[11px] font-medium text-foreground text-center leading-tight truncate w-full">
        {device.model}
      </p>
      {/* Resolution + vendor */}
      <p className="text-[9px] text-muted-foreground text-center leading-tight truncate w-full">
        {res && <span>{res} · </span>}
        {device.vendor}
      </p>
      {/* Compliance badges */}
      <div className="flex items-center gap-1">
        {device.ndaa_compliant && (
          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded border border-green-500/50 text-green-500 leading-none">
            NDAA
          </span>
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
