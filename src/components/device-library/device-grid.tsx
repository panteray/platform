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

/* ───────── Form Factor Icon SVGs — realistic CCTV camera shapes ───────── */

function FormIcon({ type, size = 20, color }: { type: string; size?: number; color: string }) {
  const s = { width: size, height: size, fill: 'none' as const }
  switch (type.toLowerCase().replace(/[\s_-]/g, '')) {

    /* ── Box camera ──
       Side view: rectangular housing body, lens barrel protruding right,
       wall bracket arm underneath */
    case 'box': case 'highresolutionbox': return (
      <svg viewBox="0 0 40 32" {...s}>
        {/* Wall bracket arm */}
        <path d="M8 26 L8 22 L32 22 L32 18" stroke={color} strokeWidth="1.5" fill="none" />
        <rect x="4" y="24" width="8" height="4" rx="1" fill={color} opacity="0.15" stroke={color} strokeWidth="1" />
        {/* Housing body */}
        <rect x="10" y="4" width="22" height="14" rx="1" fill={color} opacity="0.08" stroke={color} strokeWidth="1.5" />
        {/* Sun shield / visor on top */}
        <path d="M9 4 L9 2 L33 2 L33 4" stroke={color} strokeWidth="1.2" />
        {/* Lens barrel */}
        <rect x="32" y="7" width="5" height="8" rx="1" fill={color} opacity="0.12" stroke={color} strokeWidth="1.2" />
        <circle cx="37" cy="11" r="2.5" stroke={color} strokeWidth="1" />
        <circle cx="37" cy="11" r="1" fill={color} opacity="0.4" />
      </svg>
    )

    /* ── Bullet camera ──
       Side view: long cylindrical body with rounded front, sun visor on top,
       wall mount bracket arm below, IR LED ring around lens */
    case 'bullet': case 'thermalbullet': return (
      <svg viewBox="0 0 40 32" {...s}>
        {/* Wall bracket */}
        <path d="M6 28 L6 20 L12 16" stroke={color} strokeWidth="1.5" />
        <rect x="2" y="26" width="8" height="4" rx="1" fill={color} opacity="0.15" stroke={color} strokeWidth="1" />
        {/* Sun visor */}
        <path d="M10 6 L10 4 L34 4 L36 6" stroke={color} strokeWidth="1.2" />
        {/* Body — rounded cylinder */}
        <path d="M10 6 L10 18 Q10 20 14 20 L30 20 Q36 20 36 14 L36 6 Z" fill={color} opacity="0.08" stroke={color} strokeWidth="1.5" />
        {/* Lens face with IR ring */}
        <circle cx="33" cy="13" r="5" stroke={color} strokeWidth="1.2" />
        <circle cx="33" cy="13" r="3" stroke={color} strokeWidth="0.8" />
        <circle cx="33" cy="13" r="1.2" fill={color} opacity="0.5" />
        {/* IR LED dots */}
        <circle cx="33" cy="7.5" r="0.6" fill={color} opacity="0.3" />
        <circle cx="37.5" cy="11" r="0.6" fill={color} opacity="0.3" />
        <circle cx="37.5" cy="15" r="0.6" fill={color} opacity="0.3" />
        <circle cx="33" cy="18.5" r="0.6" fill={color} opacity="0.3" />
        <circle cx="28.5" cy="15" r="0.6" fill={color} opacity="0.3" />
        <circle cx="28.5" cy="11" r="0.6" fill={color} opacity="0.3" />
      </svg>
    )

    /* ── Dome camera ──
       3/4 view: half-sphere dome sitting on a flat circular base plate,
       dark tinted dome cover on lower half, ceiling mounted */
    case 'dome': case 'minidome': return (
      <svg viewBox="0 0 40 32" {...s}>
        {/* Base plate */}
        <ellipse cx="20" cy="22" rx="14" ry="4" fill={color} opacity="0.08" stroke={color} strokeWidth="1.5" />
        {/* Upper dome shell */}
        <path d="M6 22 Q6 6 20 6 Q34 6 34 22" fill={color} opacity="0.06" stroke={color} strokeWidth="1.5" />
        {/* Tinted dome band (lower half) */}
        <path d="M8 20 Q8 13 20 13 Q32 13 32 20" fill={color} opacity="0.18" stroke={color} strokeWidth="1" />
        {/* Lens behind dome */}
        <circle cx="20" cy="17" r="2.5" stroke={color} strokeWidth="0.8" opacity="0.6" />
        <circle cx="20" cy="17" r="1" fill={color} opacity="0.3" />
      </svg>
    )

    /* ── Turret / eyeball camera ──
       Front view: round camera ball sitting in a conical cup base,
       large lens visible in center of ball */
    case 'turret': return (
      <svg viewBox="0 0 40 32" {...s}>
        {/* Conical base cup */}
        <path d="M8 28 L12 18 L28 18 L32 28 Z" fill={color} opacity="0.1" stroke={color} strokeWidth="1.2" />
        {/* Camera ball */}
        <circle cx="20" cy="14" r="9" fill={color} opacity="0.06" stroke={color} strokeWidth="1.5" />
        {/* Lens assembly */}
        <circle cx="22" cy="13" r="4.5" fill={color} opacity="0.12" stroke={color} strokeWidth="1.2" />
        <circle cx="22" cy="13" r="2.5" stroke={color} strokeWidth="0.8" />
        <circle cx="22" cy="13" r="1" fill={color} opacity="0.5" />
      </svg>
    )

    /* ── PTZ speed dome ──
       Side view: pendant mount — arm hanging from ceiling,
       spherical speed dome ball hanging below */
    case 'ptz': case 'irptz': return (
      <svg viewBox="0 0 40 32" {...s}>
        {/* Ceiling mount plate */}
        <rect x="13" y="2" width="14" height="3" rx="1" fill={color} opacity="0.12" stroke={color} strokeWidth="1.2" />
        {/* Arm / neck */}
        <path d="M17 5 L17 9 L23 9 L23 5" fill={color} opacity="0.06" stroke={color} strokeWidth="1.2" />
        {/* Speed dome — top housing */}
        <path d="M10 9 L30 9 L30 15 Q30 17 28 17 L12 17 Q10 17 10 15 Z" fill={color} opacity="0.08" stroke={color} strokeWidth="1.5" />
        {/* Speed dome — bottom sphere with lens */}
        <path d="M12 17 Q12 28 20 28 Q28 28 28 17" fill={color} opacity="0.15" stroke={color} strokeWidth="1.5" />
        {/* Lens band */}
        <ellipse cx="20" cy="22" rx="6" ry="3" stroke={color} strokeWidth="0.8" opacity="0.5" />
        <circle cx="20" cy="22" r="1.5" fill={color} opacity="0.4" />
      </svg>
    )

    /* ── Fisheye camera ──
       Top-down view: flat circular disc, wide convex lens in center,
       concentric rings */
    case 'fisheye': return (
      <svg viewBox="0 0 40 32" {...s}>
        {/* Outer body disc */}
        <circle cx="20" cy="16" r="13" fill={color} opacity="0.06" stroke={color} strokeWidth="1.5" />
        {/* Inner ring */}
        <circle cx="20" cy="16" r="8" fill={color} opacity="0.1" stroke={color} strokeWidth="1" />
        {/* Convex lens dome */}
        <circle cx="20" cy="16" r="5" fill={color} opacity="0.15" stroke={color} strokeWidth="0.8" />
        {/* Lens center */}
        <circle cx="20" cy="16" r="2" fill={color} opacity="0.25" />
        <circle cx="20" cy="16" r="0.8" fill={color} opacity="0.5" />
        {/* Light reflection */}
        <circle cx="18" cy="14" r="1.2" fill={color} opacity="0.06" />
      </svg>
    )

    /* ── Covert / pinhole camera ──
       Small discreet rectangular unit with a tiny pinhole lens */
    case 'covert': return (
      <svg viewBox="0 0 40 32" {...s}>
        {/* Small body */}
        <rect x="10" y="8" width="20" height="16" rx="2" fill={color} opacity="0.06" stroke={color} strokeWidth="1.5" />
        {/* Pinhole lens — very small */}
        <circle cx="20" cy="14" r="1.2" fill={color} opacity="0.5" />
        <circle cx="20" cy="14" r="0.5" fill={color} />
        {/* Status LED */}
        <circle cx="26" cy="11" r="0.7" fill={color} opacity="0.3" />
        {/* Cable */}
        <path d="M20 24 L20 30" stroke={color} strokeWidth="1" opacity="0.4" />
      </svg>
    )

    /* ── Multisensor / multi-directional camera ──
       Top-down view: central body with multiple lens heads pointing outward */
    case 'multisensor': case 'multidirectional': return (
      <svg viewBox="0 0 40 32" {...s}>
        {/* Central body */}
        <circle cx="20" cy="16" r="5" fill={color} opacity="0.1" stroke={color} strokeWidth="1" />
        {/* 4 sensor heads pointing outward */}
        <ellipse cx="10" cy="8" rx="5" ry="3.5" fill={color} opacity="0.08" stroke={color} strokeWidth="1.3" />
        <circle cx="8" cy="8" r="1.2" fill={color} opacity="0.4" />
        <ellipse cx="30" cy="8" rx="5" ry="3.5" fill={color} opacity="0.08" stroke={color} strokeWidth="1.3" />
        <circle cx="32" cy="8" r="1.2" fill={color} opacity="0.4" />
        <ellipse cx="10" cy="24" rx="5" ry="3.5" fill={color} opacity="0.08" stroke={color} strokeWidth="1.3" />
        <circle cx="8" cy="24" r="1.2" fill={color} opacity="0.4" />
        <ellipse cx="30" cy="24" rx="5" ry="3.5" fill={color} opacity="0.08" stroke={color} strokeWidth="1.3" />
        <circle cx="32" cy="24" r="1.2" fill={color} opacity="0.4" />
      </svg>
    )

    /* ── Corner mount camera ──
       Dome camera mounted on a triangular corner bracket */
    case 'corner': return (
      <svg viewBox="0 0 40 32" {...s}>
        {/* Corner walls */}
        <path d="M2 2 L2 30" stroke={color} strokeWidth="1.5" />
        <path d="M2 30 L38 30" stroke={color} strokeWidth="1.5" />
        {/* Triangular corner bracket */}
        <path d="M2 12 L16 12 L16 30" fill={color} opacity="0.06" stroke={color} strokeWidth="1" />
        {/* Dome camera on bracket */}
        <ellipse cx="16" cy="12" rx="10" ry="3" fill={color} opacity="0.08" stroke={color} strokeWidth="1.2" />
        <path d="M8 12 Q8 4 16 4 Q24 4 24 12" fill={color} opacity="0.06" stroke={color} strokeWidth="1.3" />
        <circle cx="16" cy="9" r="2" stroke={color} strokeWidth="0.8" opacity="0.5" />
        <circle cx="16" cy="9" r="0.8" fill={color} opacity="0.3" />
      </svg>
    )

    /* ── Video Intercom ──
       Wall-mounted panel with camera lens at top, speaker grille, call button */
    case 'videointercom': return (
      <svg viewBox="0 0 40 32" {...s}>
        {/* Panel body */}
        <rect x="8" y="2" width="24" height="28" rx="2" fill={color} opacity="0.06" stroke={color} strokeWidth="1.5" />
        {/* Camera lens */}
        <circle cx="20" cy="9" r="3.5" fill={color} opacity="0.1" stroke={color} strokeWidth="1.2" />
        <circle cx="20" cy="9" r="1.5" fill={color} opacity="0.4" />
        {/* Speaker grille */}
        {[16, 18, 20, 22].map(y => (
          <line key={y} x1="13" y1={y} x2="27" y2={y} stroke={color} strokeWidth="0.7" opacity="0.25" />
        ))}
        {/* Call button */}
        <circle cx="20" cy="26" r="2" fill={color} opacity="0.12" stroke={color} strokeWidth="1" />
      </svg>
    )

    /* ── Modular camera ──
       Separate sensor head + processor box connected by cable */
    case 'modular': return (
      <svg viewBox="0 0 40 32" {...s}>
        {/* Sensor head (small) */}
        <rect x="2" y="8" width="10" height="10" rx="2" fill={color} opacity="0.08" stroke={color} strokeWidth="1.3" />
        <circle cx="7" cy="13" r="3" stroke={color} strokeWidth="1" />
        <circle cx="7" cy="13" r="1.2" fill={color} opacity="0.4" />
        {/* Cable between */}
        <path d="M12 13 Q18 13 18 16 Q18 19 24 19" stroke={color} strokeWidth="1" strokeDasharray="2 1.5" opacity="0.4" />
        {/* Processor box */}
        <rect x="24" y="10" width="14" height="12" rx="1.5" fill={color} opacity="0.06" stroke={color} strokeWidth="1.3" />
        {/* Ports/vents on processor */}
        <line x1="27" y1="14" x2="35" y2="14" stroke={color} strokeWidth="0.6" opacity="0.2" />
        <line x1="27" y1="16" x2="35" y2="16" stroke={color} strokeWidth="0.6" opacity="0.2" />
        <line x1="27" y1="18" x2="35" y2="18" stroke={color} strokeWidth="0.6" opacity="0.2" />
      </svg>
    )

    /* ── Default / generic camera ── */
    default: return (
      <svg viewBox="0 0 40 32" {...s}>
        <rect x="6" y="6" width="20" height="14" rx="2" fill={color} opacity="0.06" stroke={color} strokeWidth="1.5" />
        <rect x="26" y="9" width="8" height="8" rx="1" fill={color} opacity="0.08" stroke={color} strokeWidth="1.2" />
        <circle cx="30" cy="13" r="2.5" stroke={color} strokeWidth="0.8" />
        <circle cx="30" cy="13" r="1" fill={color} opacity="0.4" />
      </svg>
    )
  }
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
      .catch(() => {})
    fetch('/api/org/device-library/manufacturers-list')
      .then(r => r.json())
      .then(j => setManufacturers(j.manufacturers ?? []))
      .catch(() => {})
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
      return true
    })
  }, [results, selectedVendor, selectedForms, selectedRes, selectedNdaa])

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
  const activeFilterCount = (selectedVendor ? 1 : 0) + selectedForms.size + (selectedRes ? 1 : 0) + (selectedNdaa ? 1 : 0)

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
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            ref={searchRef}
            value={query}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search vendor, model, part number..."
            className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#2b8fce] focus:outline-none"
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
      {/* NDAA badge */}
      {device.ndaa_compliant && (
        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded border border-green-500/50 text-green-500 leading-none">
          NDAA
        </span>
      )}
    </div>
  )
}
