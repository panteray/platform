'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  MapPin, CheckCircle2, Circle, AlertTriangle, QrCode,
  ChevronRight, Camera, X,
} from 'lucide-react'
import type { InstallItem } from '@/types/database'

interface Props { projectId: string }

const STATUS_COLORS: Record<string, { bg: string; dot: string }> = {
  planned:                { bg: 'bg-neutral-100', dot: 'bg-neutral-400' },
  installation_requested: { bg: 'bg-blue-50',     dot: 'bg-blue-500' },
  installed:              { bg: 'bg-emerald-50',   dot: 'bg-emerald-500' },
  deviation:              { bg: 'bg-red-50',       dot: 'bg-red-500' },
}

export function SmartHub({ projectId }: Props) {
  const [items, setItems] = useState<InstallItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [serialInput, setSerialInput] = useState('')
  const [macInput, setMacInput] = useState('')
  const [deviationNote, setDeviationNote] = useState('')
  const [analyzing, setAnalyzing] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/org/projects/${projectId}/install`)
    if (res.ok) setItems(await res.json())
    setLoading(false)
  }, [projectId])

  useEffect(() => { load() }, [load])

  const selected = items.find(i => i.id === selectedId) ?? null

  const markInstalled = async (itemId: string) => {
    await fetch(`/api/org/projects/${projectId}/install/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'installed',
        serial_number: serialInput || null,
        mac_address: macInput || null,
      }),
    })
    setSelectedId(null)
    setSerialInput('')
    setMacInput('')
    await load()
  }

  const reportDeviation = async (itemId: string) => {
    if (!deviationNote.trim()) return
    setAnalyzing(true)
    await fetch(`/api/org/projects/${projectId}/ai-deviation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_id: itemId,
        deviation_note: deviationNote,
        deviation_type: 'minor',
      }),
    })
    setAnalyzing(false)
    setSelectedId(null)
    setDeviationNote('')
    await load()
  }

  const totalCount = items.length
  const installedCount = items.filter(i => i.status === 'installed').length
  const deviationCount = items.filter(i => i.status === 'deviation').length
  const pct = totalCount > 0 ? Math.round((installedCount / totalCount) * 100) : 0

  if (loading) return <div className="flex h-32 items-center justify-center"><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-bold text-foreground">Smart Hub</h2>
        <p className="text-[10px] text-muted-foreground">
          {installedCount}/{totalCount} installed ({pct}%)
          {deviationCount > 0 && <span className="text-red-500 ml-1">· {deviationCount} deviations</span>}
        </p>
      </div>

      {/* Progress */}
      <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
      </div>

      {/* Item List */}
      <div className="space-y-1">
        {items.map(item => {
          const colors = STATUS_COLORS[item.status] ?? STATUS_COLORS.planned
          const isSelected = selectedId === item.id

          return (
            <div key={item.id}>
              <button
                onClick={() => setSelectedId(isSelected ? null : item.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  isSelected ? 'border-primary bg-primary/5' : `border-border ${colors.bg}`
                }`}
              >
                <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${colors.dot}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {item.category ?? 'general'} · {item.vendor ?? ''} {item.model ?? ''}
                  </p>
                </div>
                {item.status === 'installed' && <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />}
                {item.status === 'deviation' && <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />}
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              </button>

              {/* Expanded Panel */}
              {isSelected && (
                <div className="ml-5 mt-1 rounded-lg border border-border bg-card p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[11px] font-semibold text-foreground">{item.label}</h4>
                    <button onClick={() => setSelectedId(null)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Info */}
                  <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                    <span className="text-muted-foreground">Category:</span>
                    <span className="text-foreground">{item.category ?? '—'}</span>
                    <span className="text-muted-foreground">Vendor:</span>
                    <span className="text-foreground">{item.vendor ?? '—'}</span>
                    <span className="text-muted-foreground">Model:</span>
                    <span className="text-foreground">{item.model ?? '—'}</span>
                    <span className="text-muted-foreground">Qty:</span>
                    <span className="text-foreground">{item.quantity}</span>
                    {item.serial_number && (
                      <>
                        <span className="text-muted-foreground">Serial:</span>
                        <span className="text-foreground font-mono">{item.serial_number}</span>
                      </>
                    )}
                    {item.mac_address && (
                      <>
                        <span className="text-muted-foreground">MAC:</span>
                        <span className="text-foreground font-mono">{item.mac_address}</span>
                      </>
                    )}
                  </div>

                  {/* Deviation AI Analysis */}
                  {item.deviation_ai_analysis && (
                    <div className="rounded border border-red-200 bg-red-50 p-2">
                      <p className="text-[10px] font-bold text-red-700 mb-0.5">AI Deviation Analysis</p>
                      <p className="text-[10px] text-red-800 whitespace-pre-wrap">{item.deviation_ai_analysis}</p>
                    </div>
                  )}

                  {/* Actions for non-installed items */}
                  {item.status !== 'installed' && item.status !== 'deviation' && (
                    <div className="space-y-2 border-t border-border pt-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] font-medium text-muted-foreground mb-0.5 flex items-center gap-0.5">
                            <QrCode className="h-2.5 w-2.5" /> Serial #
                          </label>
                          <input
                            value={serialInput}
                            onChange={e => setSerialInput(e.target.value)}
                            placeholder="Scan or type"
                            className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs font-mono outline-none focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-medium text-muted-foreground mb-0.5">MAC Address</label>
                          <input
                            value={macInput}
                            onChange={e => setMacInput(e.target.value)}
                            placeholder="00:00:00:00:00:00"
                            className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs font-mono outline-none focus:border-primary"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => markInstalled(item.id)}
                          className="flex-1 rounded-md bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-700 flex items-center justify-center gap-1"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Mark Installed
                        </button>
                        <button
                          onClick={() => {
                            const note = prompt('Describe the deviation:')
                            if (note) { setDeviationNote(note); reportDeviation(item.id) }
                          }}
                          className="rounded-md border border-red-300 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {items.length === 0 && (
          <div className="flex flex-col items-center py-8 text-muted-foreground">
            <MapPin className="mb-2 h-6 w-6 text-muted-foreground/40" />
            <p className="text-xs">No install items</p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">Items are generated from the hardware schedule</p>
          </div>
        )}
      </div>
    </div>
  )
}
