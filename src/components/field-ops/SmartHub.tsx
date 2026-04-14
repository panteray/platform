'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  MapPin, CheckCircle2, AlertTriangle, QrCode, ChevronRight, X,
  Info, Camera, FileWarning, Image as ImageIcon,
} from 'lucide-react'
import type { InstallItem } from '@/types/database'

interface Props { projectId: string }

type BladeTab = 'info' | 'serial' | 'deviation' | 'photos'

const STATUS_DOT: Record<string, string> = {
  planned: 'bg-neutral-400',
  installation_requested: 'bg-blue-500',
  in_review: 'bg-amber-500',
  installed: 'bg-emerald-500',
  deviation: 'bg-red-500',
}

export function SmartHub({ projectId }: Props) {
  const [items, setItems] = useState<InstallItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [bladeTab, setBladeTab] = useState<BladeTab>('info')

  // Form state
  const [serialInput, setSerialInput] = useState('')
  const [macInput, setMacInput] = useState('')
  const [deviationNote, setDeviationNote] = useState('')
  const [deviationType, setDeviationType] = useState<'minor' | 'major'>('minor')
  const [photoUrl, setPhotoUrl] = useState('')
  const [photoCaption, setPhotoCaption] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [matchResult, setMatchResult] = useState<'green' | 'red' | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/org/projects/${projectId}/install`)
    if (res.ok) setItems(await res.json())
    setLoading(false)
  }, [projectId])

  useEffect(() => { load() }, [load])

  const selected = items.find(i => i.id === selectedId) ?? null

  // Reset form when selection changes
  useEffect(() => {
    setSerialInput(selected?.serial_number ?? '')
    setMacInput(selected?.mac_address ?? '')
    setDeviationNote('')
    setPhotoUrl('')
    setPhotoCaption('')
    setMatchResult(null)
    setBladeTab('info')
  }, [selectedId, selected?.serial_number, selected?.mac_address])

  const submitInstall = async () => {
    if (!selected) return
    setSubmitting(true)
    const res = await fetch(`/api/org/projects/${projectId}/install/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'in_review',
        serial_number: serialInput || null,
        mac_address: macInput || null,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setMatchResult(data.match_status ?? null)
      await load()
    }
    setSubmitting(false)
  }

  const submitDeviation = async () => {
    if (!selected || !deviationNote.trim()) return
    setSubmitting(true)
    await fetch(`/api/org/projects/${projectId}/ai-deviation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_id: selected.id,
        deviation_note: deviationNote,
        deviation_type: deviationType,
      }),
    })
    setDeviationNote('')
    setSubmitting(false)
    await load()
  }

  const addPhoto = async () => {
    if (!selected || !photoUrl) return
    setSubmitting(true)
    const newPhotos = [
      ...(selected.photos ?? []),
      { url: photoUrl, caption: photoCaption, taken_at: new Date().toISOString() },
    ]
    await fetch(`/api/org/projects/${projectId}/install/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photos: newPhotos }),
    })
    setPhotoUrl(''); setPhotoCaption('')
    setSubmitting(false)
    await load()
  }

  const total = items.length
  const installedCount = items.filter(i => i.status === 'installed').length
  const reviewCount = items.filter(i => i.status === 'in_review').length
  const deviationCount = items.filter(i => i.status === 'deviation').length
  const pct = total > 0 ? Math.round((installedCount / total) * 100) : 0

  if (loading) return <div className="flex h-32 items-center justify-center"><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-bold text-foreground">Smart Hub</h2>
        <p className="text-[10px] text-muted-foreground">
          {installedCount}/{total} installed ({pct}%)
          {reviewCount > 0 && <span className="text-amber-600 ml-1">· {reviewCount} pending review</span>}
          {deviationCount > 0 && <span className="text-red-500 ml-1">· {deviationCount} deviations</span>}
        </p>
      </div>

      <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="space-y-1">
        {items.map(item => {
          const isSel = selectedId === item.id
          return (
            <div key={item.id}>
              <button
                onClick={() => setSelectedId(isSel ? null : item.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  isSel ? 'border-primary bg-primary/5' : 'border-border bg-background hover:bg-accent/30'
                }`}
              >
                <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${STATUS_DOT[item.status] ?? 'bg-neutral-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {item.category ?? 'general'} · {item.vendor ?? ''} {item.model ?? ''}
                  </p>
                </div>
                {item.status === 'installed' && <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />}
                {item.status === 'in_review' && <FileWarning className="h-4 w-4 text-amber-500 flex-shrink-0" />}
                {item.status === 'deviation' && <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />}
                <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground flex-shrink-0 transition-transform ${isSel ? 'rotate-90' : ''}`} />
              </button>

              {/* Blade Panel */}
              {isSel && selected && (
                <div className="ml-5 mt-1 rounded-lg border border-border bg-card overflow-hidden">
                  <div className="flex items-center justify-between border-b border-border px-3 py-2">
                    <h4 className="text-[11px] font-semibold">{selected.label}</h4>
                    <button onClick={() => setSelectedId(null)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Tab Bar */}
                  <div className="flex border-b border-border">
                    {(['info', 'serial', 'deviation', 'photos'] as BladeTab[]).map(t => (
                      <button
                        key={t}
                        onClick={() => setBladeTab(t)}
                        className={`flex-1 flex items-center justify-center gap-1 py-2 text-[10px] font-bold uppercase ${
                          bladeTab === t ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'
                        }`}
                      >
                        {t === 'info' && <Info className="h-3 w-3" />}
                        {t === 'serial' && <QrCode className="h-3 w-3" />}
                        {t === 'deviation' && <AlertTriangle className="h-3 w-3" />}
                        {t === 'photos' && <Camera className="h-3 w-3" />}
                        {t}
                      </button>
                    ))}
                  </div>

                  <div className="p-3">
                    {/* INFO TAB */}
                    {bladeTab === 'info' && (
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                        <span className="text-muted-foreground">Status</span>
                        <span className="font-bold">{selected.status.replace(/_/g, ' ')}</span>
                        <span className="text-muted-foreground">Category</span>
                        <span>{selected.category ?? '—'}</span>
                        <span className="text-muted-foreground">Vendor</span>
                        <span>{selected.vendor ?? '—'}</span>
                        <span className="text-muted-foreground">Model</span>
                        <span>{selected.model ?? '—'}</span>
                        <span className="text-muted-foreground">Quantity</span>
                        <span>{selected.quantity}</span>
                        <span className="text-muted-foreground">HW Line</span>
                        <span>{selected.hw_schedule_line ?? '—'}</span>
                        {selected.installed_at && (
                          <>
                            <span className="text-muted-foreground">Installed</span>
                            <span>{new Date(selected.installed_at).toLocaleString()}</span>
                          </>
                        )}
                      </div>
                    )}

                    {/* SERIAL/MAC TAB */}
                    {bladeTab === 'serial' && (
                      <div className="space-y-2.5">
                        <div>
                          <label className="text-[9px] font-bold uppercase text-muted-foreground mb-1 flex items-center gap-1">
                            <QrCode className="h-2.5 w-2.5" /> Serial Number
                          </label>
                          <input
                            value={serialInput}
                            onChange={e => setSerialInput(e.target.value)}
                            placeholder="Scan or type"
                            className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs font-mono outline-none focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold uppercase text-muted-foreground mb-1 block">MAC Address</label>
                          <input
                            value={macInput}
                            onChange={e => setMacInput(e.target.value)}
                            placeholder="00:00:00:00:00:00"
                            className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs font-mono outline-none focus:border-primary"
                          />
                        </div>

                        {matchResult && (
                          <div className={`rounded border p-2 ${matchResult === 'green' ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50'}`}>
                            <div className="flex items-center gap-1.5">
                              <div className={`h-2.5 w-2.5 rounded-full ${matchResult === 'green' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                              <p className={`text-[10px] font-bold ${matchResult === 'green' ? 'text-emerald-700' : 'text-red-700'}`}>
                                {matchResult === 'green' ? 'GREEN — Matches HW schedule' : 'RED — Mismatch detected. Submit deviation.'}
                              </p>
                            </div>
                          </div>
                        )}

                        <button
                          onClick={submitInstall}
                          disabled={submitting || selected.status === 'installed'}
                          className="w-full rounded-md bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> {submitting ? 'Submitting…' : 'Submit for Review'}
                        </button>
                      </div>
                    )}

                    {/* DEVIATION TAB */}
                    {bladeTab === 'deviation' && (
                      <div className="space-y-2.5">
                        <div>
                          <label className="text-[9px] font-bold uppercase text-muted-foreground mb-1 block">Deviation Type</label>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setDeviationType('minor')}
                              className={`flex-1 rounded py-1.5 text-[10px] font-bold ${deviationType === 'minor' ? 'bg-amber-500 text-white' : 'bg-neutral-100'}`}
                            >MINOR</button>
                            <button
                              onClick={() => setDeviationType('major')}
                              className={`flex-1 rounded py-1.5 text-[10px] font-bold ${deviationType === 'major' ? 'bg-red-600 text-white' : 'bg-neutral-100'}`}
                            >MAJOR</button>
                          </div>
                        </div>
                        <textarea
                          value={deviationNote}
                          onChange={e => setDeviationNote(e.target.value)}
                          placeholder="Describe what's different from the HW schedule…"
                          rows={4}
                          className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary resize-none"
                        />
                        {selected.deviation_ai_analysis && (
                          <div className="rounded border border-red-200 bg-red-50 p-2">
                            <p className="text-[9px] font-bold text-red-700">AI ANALYSIS</p>
                            <p className="text-[10px] text-red-900 whitespace-pre-wrap">{selected.deviation_ai_analysis}</p>
                          </div>
                        )}
                        <button
                          onClick={submitDeviation}
                          disabled={!deviationNote.trim() || submitting}
                          className="w-full rounded-md bg-red-600 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          <AlertTriangle className="h-3.5 w-3.5" /> {submitting ? 'Submitting…' : 'Report Deviation'}
                        </button>
                      </div>
                    )}

                    {/* PHOTOS TAB */}
                    {bladeTab === 'photos' && (
                      <div className="space-y-2.5">
                        {selected.photos && selected.photos.length > 0 && (
                          <div className="grid grid-cols-3 gap-1.5">
                            {selected.photos.map((p, idx) => (
                              <div key={idx} className="aspect-square rounded border border-border overflow-hidden bg-neutral-100">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={p.url} alt={p.caption ?? ''} className="h-full w-full object-cover" />
                              </div>
                            ))}
                          </div>
                        )}
                        <input
                          value={photoUrl}
                          onChange={e => setPhotoUrl(e.target.value)}
                          placeholder="Photo URL"
                          className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
                        />
                        <input
                          value={photoCaption}
                          onChange={e => setPhotoCaption(e.target.value)}
                          placeholder="Caption (optional)"
                          className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
                        />
                        <button
                          onClick={addPhoto}
                          disabled={!photoUrl || submitting}
                          className="w-full rounded-md bg-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          <ImageIcon className="h-3.5 w-3.5" /> Add Photo
                        </button>
                      </div>
                    )}
                  </div>
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
