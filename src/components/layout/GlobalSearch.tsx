'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  Briefcase,
  FolderKanban,
  Building2,
  TicketCheck,
  Package,
  Users,
  X,
  Clock,
  Loader2,
} from 'lucide-react'

interface SearchResult {
  entity_type: string
  title: string
  subtitle?: string
  url: string
}

const ENTITY_CONFIG: Record<string, { label: string; icon: typeof Briefcase }> = {
  opportunity: { label: 'Opportunities', icon: Briefcase },
  project: { label: 'Projects', icon: FolderKanban },
  customer: { label: 'Customers', icon: Building2 },
  ticket: { label: 'Tickets', icon: TicketCheck },
  asset: { label: 'Assets', icon: Package },
  subcontractor: { label: 'Subcontractors', icon: Users },
}

const RECENT_KEY = 'panteray_recent_searches'

function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(RECENT_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveRecentSearch(query: string) {
  if (!query.trim()) return
  const recent = getRecentSearches().filter((q) => q !== query)
  recent.unshift(query)
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 5)))
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().includes('MAC')
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setRecentSearches(getRecentSearches())
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const fetchResults = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/org/search?q=${encodeURIComponent(q)}&limit=20`)
      if (res.ok) {
        const data = await res.json()
        setResults(data.results ?? data ?? [])
      } else {
        setResults([])
      }
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  function handleInputChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchResults(value), 300)
  }

  function handleResultClick(result: SearchResult) {
    saveRecentSearch(query)
    setOpen(false)
    router.push(result.url)
  }

  function handleRecentClick(q: string) {
    setQuery(q)
    fetchResults(q)
  }

  if (!open) return null

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    const key = r.entity_type || 'other'
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {})

  const showRecent = !query.trim() && recentSearches.length > 0
  const showEmpty = !query.trim() && recentSearches.length === 0
  const showNoResults = query.trim() && !loading && results.length === 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      <div className="fixed inset-0 bg-black/50" />
      <div
        className="relative z-10 w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Search across all entities..."
            className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
          {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" />}
          <button
            onClick={() => setOpen(false)}
            className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 hover:text-slate-600"
          >
            ESC
          </button>
        </div>

        {/* Results area */}
        <div className="max-h-[400px] overflow-y-auto p-2">
          {showEmpty && (
            <p className="px-3 py-8 text-center text-sm text-slate-400">
              Type to search across all entities...
            </p>
          )}

          {showRecent && (
            <div>
              <p className="px-3 py-1.5 text-xs font-medium text-slate-400">Recent searches</p>
              {recentSearches.map((q) => (
                <button
                  key={q}
                  onClick={() => handleRecentClick(q)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
                >
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  {q}
                </button>
              ))}
            </div>
          )}

          {showNoResults && (
            <p className="px-3 py-8 text-center text-sm text-slate-400">
              No results found for &ldquo;{query}&rdquo;
            </p>
          )}

          {Object.entries(grouped).map(([type, items]) => {
            const config = ENTITY_CONFIG[type]
            const Icon = config?.icon ?? Package
            const label = config?.label ?? type
            return (
              <div key={type}>
                <p className="px-3 py-1.5 text-xs font-medium text-slate-400">{label}</p>
                {items.map((item, idx) => (
                  <button
                    key={`${type}-${idx}`}
                    onClick={() => handleResultClick(item)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-50"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-slate-800">{item.title}</p>
                      {item.subtitle && (
                        <p className="truncate text-xs text-slate-400">{item.subtitle}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
