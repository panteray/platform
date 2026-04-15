'use client'

// TimeEntryPanel — start/stop live timer + manual entry form + entries list.
// Drops into the existing ticket detail Time tab, replacing the manual-only form.
// Timer state persists across mounts via localStorage so a tech can navigate away
// and come back without losing accrued time.

import { useState, useEffect, useRef } from 'react'
import { Play, Square, Plus, X, Clock } from 'lucide-react'
import type { PsaTimeEntry } from '@/types/database'

type EntryWithUser = PsaTimeEntry & {
  user?: { id: string; first_name: string | null; last_name: string | null } | null
}

type Props = {
  ticketId: string
  entries: EntryWithUser[]
  onReload: () => void
}

const STORAGE_KEY_PREFIX = 'psa-timer:'

function userName(u?: { first_name: string | null; last_name: string | null } | null): string {
  if (!u) return '—'
  return `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || '—'
}

export function TimeEntryPanel({ ticketId, entries, onReload }: Props) {
  const storageKey = `${STORAGE_KEY_PREFIX}${ticketId}`

  // Live timer state
  const [runningSince, setRunningSince] = useState<number | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [description, setDescription] = useState('')
  const [billable, setBillable] = useState(true)
  const tickRef = useRef<number | null>(null)

  // Manual entry state
  const [showManual, setShowManual] = useState(false)
  const [manualHours, setManualHours] = useState('')
  const [manualDescription, setManualDescription] = useState('')
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0])
  const [manualBillable, setManualBillable] = useState(true)

  // Rehydrate running timer from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed = JSON.parse(stored) as { since: number; description: string; billable: boolean }
        setRunningSince(parsed.since)
        setDescription(parsed.description ?? '')
        setBillable(parsed.billable ?? true)
        setElapsedMs(Date.now() - parsed.since)
      }
    } catch {
      /* ignore */
    }
  }, [storageKey])

  // Tick while running
  useEffect(() => {
    if (runningSince == null) {
      if (tickRef.current) {
        window.clearInterval(tickRef.current)
        tickRef.current = null
      }
      return
    }
    tickRef.current = window.setInterval(() => {
      setElapsedMs(Date.now() - runningSince)
    }, 1000) as unknown as number
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current)
    }
  }, [runningSince])

  function startTimer() {
    const since = Date.now()
    setRunningSince(since)
    setElapsedMs(0)
    try {
      localStorage.setItem(storageKey, JSON.stringify({ since, description, billable }))
    } catch {
      /* ignore */
    }
  }

  async function stopTimer() {
    if (runningSince == null) return
    const hours = Math.max(0.01, (Date.now() - runningSince) / 3600000)
    const entryDate = new Date().toISOString().split('T')[0]

    await fetch(`/api/org/psa/tickets/${ticketId}/time`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hours: Math.round(hours * 100) / 100,
        description,
        billable,
        entry_date: entryDate,
      }),
    })

    setRunningSince(null)
    setElapsedMs(0)
    setDescription('')
    try { localStorage.removeItem(storageKey) } catch { /* ignore */ }
    onReload()
  }

  function cancelTimer() {
    setRunningSince(null)
    setElapsedMs(0)
    try { localStorage.removeItem(storageKey) } catch { /* ignore */ }
  }

  async function submitManual() {
    const h = parseFloat(manualHours)
    if (!h || h <= 0) return
    await fetch(`/api/org/psa/tickets/${ticketId}/time`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hours: h,
        description: manualDescription,
        billable: manualBillable,
        entry_date: manualDate,
      }),
    })
    setManualHours('')
    setManualDescription('')
    setShowManual(false)
    onReload()
  }

  const total = entries.reduce((s, e) => s + Number(e.hours), 0)
  const billableTotal = entries.filter(e => e.billable).reduce((s, e) => s + Number(e.hours), 0)
  const isRunning = runningSince != null
  const elapsedHMS = msToHMS(elapsedMs)

  return (
    <div className="space-y-4">
      {/* Live timer */}
      <div className={`rounded-lg border p-4 ${isRunning ? 'bg-emerald-50 border-emerald-300' : 'bg-neutral-50 border-neutral-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isRunning ? 'bg-emerald-600' : 'bg-neutral-400'}`}>
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-neutral-500 font-semibold">
                {isRunning ? 'Timer running' : 'Live timer'}
              </div>
              <div className={`font-mono text-2xl font-bold ${isRunning ? 'text-emerald-700' : 'text-neutral-400'}`}>
                {elapsedHMS}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isRunning ? (
              <>
                <button
                  onClick={cancelTimer}
                  className="px-3 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900"
                >
                  Cancel
                </button>
                <button
                  onClick={stopTimer}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-md text-sm font-semibold hover:bg-red-700"
                >
                  <Square className="w-3.5 h-3.5" /> Stop &amp; Save
                </button>
              </>
            ) : (
              <button
                onClick={startTimer}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-semibold hover:bg-emerald-700"
              >
                <Play className="w-3.5 h-3.5" /> Start
              </button>
            )}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-[1fr,auto] gap-2 items-center">
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What are you working on?"
            className="px-3 py-1.5 border border-neutral-300 rounded text-sm bg-white"
          />
          <label className="flex items-center gap-1.5 text-xs text-neutral-700">
            <input type="checkbox" checked={billable} onChange={e => setBillable(e.target.checked)} />
            Billable
          </label>
        </div>
      </div>

      {/* Manual entry toggle */}
      <div className="flex items-center justify-between">
        <div className="text-sm">
          <span className="font-semibold">{total.toFixed(2)}h</span> total
          <span className="text-neutral-500 ml-2">({billableTotal.toFixed(2)}h billable)</span>
        </div>
        <button
          onClick={() => setShowManual(!showManual)}
          className="inline-flex items-center gap-1 px-3 py-1.5 border border-neutral-300 text-neutral-700 rounded text-xs font-medium hover:bg-neutral-50"
        >
          {showManual ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
          {showManual ? 'Cancel' : 'Manual Entry'}
        </button>
      </div>

      {showManual && (
        <div className="border border-neutral-200 rounded p-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Hours</label>
            <input type="number" step="0.25" value={manualHours} onChange={e => setManualHours(e.target.value)}
              className="w-full px-3 py-1.5 border border-neutral-300 rounded text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Date</label>
            <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)}
              className="w-full px-3 py-1.5 border border-neutral-300 rounded text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-neutral-600 mb-1">Description</label>
            <input type="text" value={manualDescription} onChange={e => setManualDescription(e.target.value)}
              className="w-full px-3 py-1.5 border border-neutral-300 rounded text-sm" />
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={manualBillable} onChange={e => setManualBillable(e.target.checked)} />
            Billable
          </label>
          <button onClick={submitManual} className="col-span-2 px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
            Save Entry
          </button>
        </div>
      )}

      {/* Entries list */}
      {entries.length === 0 ? (
        <div className="text-center text-sm text-neutral-500 py-8">No time logged</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200">
              <th className="py-2 font-medium">Date</th>
              <th className="py-2 font-medium">User</th>
              <th className="py-2 font-medium">Hours</th>
              <th className="py-2 font-medium">Description</th>
              <th className="py-2 font-medium">Billable</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.id} className="border-b border-neutral-100">
                <td className="py-2">{e.entry_date}</td>
                <td className="py-2">{userName(e.user)}</td>
                <td className="py-2 font-mono">{Number(e.hours).toFixed(2)}</td>
                <td className="py-2 text-neutral-600">{e.description ?? '—'}</td>
                <td className="py-2">{e.billable ? '✓' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function msToHMS(ms: number): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}
