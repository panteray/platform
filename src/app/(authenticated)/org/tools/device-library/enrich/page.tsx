'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Play, Pause, RefreshCw } from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { DEVICE_LIBRARY_ROLES } from '@/types/enums'

interface MfrData {
  total: number
  needs_enrichment: number
  devices: { id: string; model: string; missing: string[] }[]
}

const BATCH_SIZE = 30
const BATCH_DELAY = 1000

export default function EnrichPage() {
  const { userRole, loading: userLoading } = useUser()
  const [manufacturers, setManufacturers] = useState<Record<string, MfrData>>({})
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Enrichment state
  const [running, setRunning] = useState(false)
  const [paused, setPaused] = useState(false)
  const [logs, setLogs] = useState<{ time: string; msg: string; type: 'info' | 'ok' | 'err' }[]>([])
  const [apiCalls, setApiCalls] = useState(0)
  const [enrichedCount, setEnrichedCount] = useState(0)
  const [currentMfr, setCurrentMfr] = useState<string | null>(null)
  const [mfrProgress, setMfrProgress] = useState<Record<string, { done: number; total: number }>>({})

  const pausedRef = useRef(false)
  const runningRef = useRef(false)
  const logRef = useRef<HTMLDivElement>(null)

  const hasAccess = userRole && (DEVICE_LIBRARY_ROLES as readonly string[]).includes(userRole)

  function addLog(msg: string, type: 'info' | 'ok' | 'err' = 'info') {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false })
    setLogs((prev) => [...prev, { time, msg, type }])
    setTimeout(() => {
      if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
    }, 50)
  }

  const loadManufacturers = useCallback(async () => {
    setLoadingData(true)
    setError(null)
    try {
      const res = await fetch('/api/org/device-library/enrich')
      if (!res.ok) {
        const json = await res.json()
        setError(json.error ?? 'Failed to load')
        return
      }
      const json = await res.json()
      setManufacturers(json.manufacturers ?? {})
    } catch {
      setError('Network error')
    } finally {
      setLoadingData(false)
    }
  }, [])

  useEffect(() => {
    if (hasAccess) void loadManufacturers()
  }, [hasAccess, loadManufacturers])

  const totalDevices = Object.values(manufacturers).reduce((s, m) => s + m.total, 0)
  const totalNeeds = Object.values(manufacturers).reduce((s, m) => s + m.needs_enrichment, 0)

  async function startEnrichment() {
    setRunning(true)
    runningRef.current = true
    setPaused(false)
    pausedRef.current = false
    setEnrichedCount(0)
    setApiCalls(0)
    setLogs([])
    addLog('Starting AI enrichment...', 'info')

    for (const [mfr, data] of Object.entries(manufacturers)) {
      if (!runningRef.current) break

      const toProcess = data.devices
      if (toProcess.length === 0) {
        addLog(`${mfr}: all enriched`, 'ok')
        continue
      }

      setCurrentMfr(mfr)
      const batches = Math.ceil(toProcess.length / BATCH_SIZE)
      addLog(`${mfr}: ${toProcess.length} devices, ${batches} batch${batches > 1 ? 'es' : ''}`, 'info')
      setMfrProgress((prev) => ({ ...prev, [mfr]: { done: 0, total: toProcess.length } }))

      for (let b = 0; b < batches; b++) {
        // Wait while paused
        while (pausedRef.current && runningRef.current) {
          await new Promise((r) => setTimeout(r, 300))
        }
        if (!runningRef.current) break

        const batch = toProcess.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE)
        const ids = batch.map((d) => d.id)

        try {
          const res = await fetch('/api/org/device-library/enrich', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_ids: ids }),
          })
          const json = await res.json()

          if (!res.ok) {
            addLog(`${mfr} [${b + 1}/${batches}] error: ${json.error}`, 'err')
            await new Promise((r) => setTimeout(r, 3000))
            continue
          }

          setApiCalls((prev) => prev + 1)
          setEnrichedCount((prev) => prev + json.updated)
          setMfrProgress((prev) => ({
            ...prev,
            [mfr]: { done: Math.min((b + 1) * BATCH_SIZE, toProcess.length), total: toProcess.length },
          }))
          addLog(`${mfr} [${b + 1}/${batches}] ${json.processed} processed, ${json.updated} updated`, 'ok')

          if (b < batches - 1) {
            await new Promise((r) => setTimeout(r, BATCH_DELAY))
          }
        } catch (err) {
          addLog(`${mfr} [${b + 1}/${batches}] network error`, 'err')
          await new Promise((r) => setTimeout(r, 3000))
        }
      }

      setMfrProgress((prev) => ({ ...prev, [mfr]: { done: toProcess.length, total: toProcess.length } }))
    }

    addLog('Enrichment complete.', 'ok')
    setRunning(false)
    runningRef.current = false
    setCurrentMfr(null)
    // Reload data to see updated state
    await loadManufacturers()
  }

  function togglePause() {
    const next = !paused
    setPaused(next)
    pausedRef.current = next
    addLog(next ? 'Paused.' : 'Resumed.', 'info')
  }

  function stopEnrichment() {
    runningRef.current = false
    setRunning(false)
    setPaused(false)
    pausedRef.current = false
    addLog('Stopped.', 'info')
  }

  if (userLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white">Enrich Devices</h1>
        <p className="text-sm text-zinc-500">Loading...</p>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white">Enrich Devices</h1>
        <p className="text-sm text-zinc-500">Access denied.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/org/tools/device-library"
          className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-white">Enrich Devices</h1>
          <p className="text-sm text-zinc-500">AI fills missing camera specs from device knowledge</p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <p className="text-xl font-medium text-white">{loadingData ? '...' : totalDevices}</p>
          <p className="text-[11px] text-zinc-500">Total devices</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <p className="text-xl font-medium text-white">{loadingData ? '...' : totalNeeds}</p>
          <p className="text-[11px] text-zinc-500">Need enrichment</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <p className="text-xl font-medium text-white">{enrichedCount}</p>
          <p className="text-[11px] text-zinc-500">Enriched this run</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <p className="text-xl font-medium text-white">{apiCalls}</p>
          <p className="text-[11px] text-zinc-500">API calls</p>
        </div>
      </div>

      {/* Global progress */}
      {running && (
        <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-green-500 transition-all duration-500"
            style={{
              width: totalNeeds > 0
                ? `${Math.round((enrichedCount / totalNeeds) * 100)}%`
                : '0%',
            }}
          />
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2">
        {!running ? (
          <button
            onClick={startEnrichment}
            disabled={loadingData || totalNeeds === 0}
            className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="h-4 w-4" />
            Start Enrichment
          </button>
        ) : (
          <>
            <button
              onClick={togglePause}
              className="inline-flex items-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-900 transition-colors"
            >
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              {paused ? 'Resume' : 'Pause'}
            </button>
            <button
              onClick={stopEnrichment}
              className="inline-flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors"
            >
              Stop
            </button>
          </>
        )}
        <button
          onClick={loadManufacturers}
          disabled={loadingData || running}
          className="inline-flex items-center gap-2 rounded-md border border-zinc-800 px-3 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-900 transition-colors disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Manufacturer cards */}
      {loadingData ? (
        <p className="text-sm text-zinc-500">Loading devices...</p>
      ) : Object.keys(manufacturers).length === 0 ? (
        <p className="text-sm text-zinc-500">No devices in the library.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(manufacturers).map(([mfr, data]) => {
            const prog = mfrProgress[mfr]
            const pct = prog ? Math.round((prog.done / prog.total) * 100) : 0
            const isActive = currentMfr === mfr
            const isDone = data.needs_enrichment === 0 || (prog && prog.done === prog.total)

            return (
              <div
                key={mfr}
                className={`rounded-lg border p-3 ${
                  isActive ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-zinc-800 bg-zinc-950'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-white">{mfr}</span>
                  {isDone ? (
                    <span className="rounded bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold text-green-400 border border-green-500/20">
                      done
                    </span>
                  ) : isActive ? (
                    <span className="rounded bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-400 border border-indigo-500/20">
                      working
                    </span>
                  ) : (
                    <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">
                      pending
                    </span>
                  )}
                </div>
                <div className="h-1 w-full rounded-full bg-zinc-800 overflow-hidden mb-1.5">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                    style={{ width: prog ? `${pct}%` : data.needs_enrichment === 0 ? '100%' : '0%' }}
                  />
                </div>
                <p className="text-[10px] text-zinc-500">
                  {data.total} devices &middot; {data.needs_enrichment} need enrichment
                </p>
              </div>
            )
          })}
        </div>
      )}

      {/* Log */}
      <div
        ref={logRef}
        className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 h-40 overflow-y-auto font-mono text-[11px] leading-relaxed"
      >
        {logs.length === 0 ? (
          <span className="text-zinc-600">Logs will appear here when enrichment starts</span>
        ) : (
          logs.map((l, i) => (
            <div key={i}>
              <span className="text-zinc-600">[{l.time}]</span>{' '}
              <span
                className={
                  l.type === 'ok' ? 'text-green-500' : l.type === 'err' ? 'text-red-400' : 'text-indigo-400'
                }
              >
                {l.msg}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
