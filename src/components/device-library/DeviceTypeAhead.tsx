'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react'
import type { DeviceSearchResult } from '@/types/database'

interface DeviceTypeAheadProps {
  category?: string
  onSelect: (device: DeviceSearchResult) => void
  placeholder?: string
}

export function DeviceTypeAhead({
  category,
  onSelect,
  placeholder = 'Search devices...',
}: DeviceTypeAheadProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DeviceSearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const doSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([])
        setOpen(false)
        return
      }

      setLoading(true)
      const params = new URLSearchParams({ q })
      if (category) params.set('category', category)
      params.set('limit', '15')

      try {
        const res = await fetch(`/api/org/device-library/search?${params}`)
        if (res.ok) {
          const json = await res.json()
          setResults(json.results ?? [])
          setOpen(true)
          setActiveIdx(0)
        }
      } finally {
        setLoading(false)
      }
    },
    [category]
  )

  function handleChange(val: string) {
    setQuery(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => doSearch(val), 300)
  }

  function handleSelect(device: DeviceSearchResult) {
    setQuery(`${device.vendor} ${device.model}`)
    setOpen(false)
    onSelect(device)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      handleSelect(results[activeIdx])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function NdaaBadge({ value }: { value: boolean | null }) {
    if (value === true) {
      return <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
    }
    if (value === false) {
      return <ShieldAlert className="h-3.5 w-3.5 text-red-500" />
    }
    return <ShieldQuestion className="h-3.5 w-3.5 text-zinc-500" />
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
        <input
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setOpen(true)
          }}
          placeholder={placeholder}
          className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 pl-9 pr-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
        />
        {loading && (
          <div className="absolute right-2.5 top-2.5">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-transparent" />
          </div>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-950 shadow-lg">
          {results.map((item, idx) => (
            <button
              key={item.id}
              onClick={() => handleSelect(item)}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-zinc-900 ${
                idx === activeIdx ? 'bg-zinc-900' : ''
              }`}
            >
              <NdaaBadge value={item.ndaa_compliant} />
              <span className="font-medium text-zinc-200">{item.vendor}</span>
              <span className="text-zinc-400">{item.model}</span>
              {item.partnumber && (
                <span className="text-[11px] text-zinc-600 ml-auto font-mono">
                  {item.partnumber}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {open && results.length === 0 && query.trim() && !loading && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 shadow-lg p-3 text-sm text-zinc-500">
          No devices found
        </div>
      )}
    </div>
  )
}
