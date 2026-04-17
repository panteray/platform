'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ArrowLeft, Send, Plus, Trash2, MapPin, Layers,
  ChevronDown, ChevronRight, Wifi, WifiOff, RefreshCw, Camera,
} from 'lucide-react'
import type { Survey, SurveyFloorPlan, SurveyDevice, SurveyInfrastructure } from '@/types/database'
import { SurveyStatusBadge } from './SurveyStatusBadge'
import { SURVEY_FLOOR_PLAN_MODES } from '@/lib/survey-constants'
import { SurveyCanvas } from './SurveyCanvas'
import { SurveyInfrastructurePanel } from './SurveyInfrastructurePanel'
import { putLocal, getPendingSyncCount, processSyncQueue } from '@/lib/survey-offline-db'

interface Props {
  surveyId: string
  onBack: () => void
}

export function SurveyDetail({ surveyId, onBack }: Props) {
  const [survey, setSurvey] = useState<Survey | null>(null)
  const [floorPlans, setFloorPlans] = useState<SurveyFloorPlan[]>([])
  const [devices, setDevices] = useState<SurveyDevice[]>([])
  const [infrastructure, setInfrastructure] = useState<SurveyInfrastructure[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [online, setOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [canvasFloorPlanId, setCanvasFloorPlanId] = useState<string | null>(null)
  const [expandedInfraId, setExpandedInfraId] = useState<string | null>(null)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refreshPending = useCallback(async () => {
    const n = await getPendingSyncCount(surveyId)
    setPendingCount(n)
  }, [surveyId])

  const runSync = useCallback(async () => {
    if (syncing) return
    setSyncing(true)
    try {
      await processSyncQueue(surveyId)
    } finally {
      setSyncing(false)
      await refreshPending()
    }
  }, [surveyId, syncing, refreshPending])

  useEffect(() => {
    const handleOnline = () => { setOnline(true); runSync() }
    const handleOffline = () => setOnline(false)
    setOnline(navigator.onLine)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    refreshPending()
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [runSync, refreshPending])

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/org/surveys/${surveyId}`)
    if (res.ok) {
      const data = await res.json()
      setSurvey(data)
      setFloorPlans(data.survey_floor_plans || [])
      setDevices(data.survey_devices || [])
      setInfrastructure(data.survey_infrastructure || [])
    }
    setLoading(false)
  }, [surveyId])

  useEffect(() => { load() }, [load])

  const autoSave = useCallback(async (updates: Partial<Survey>) => {
    if (!survey || survey.status === 'submitted') return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSaving(true)
      try {
        await putLocal('surveys', { ...survey, ...updates, id: surveyId } as Record<string, unknown> & { id: string })
        await refreshPending()
      } catch { /* offline DB unavailable */ }
      if (navigator.onLine) {
        const res = await fetch(`/api/org/surveys/${surveyId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })
        if (res.ok) {
          const updated = await res.json()
          setSurvey(prev => prev ? { ...prev, ...updated } : updated)
          runSync()
        }
      }
      setSaving(false)
    }, 800)
  }, [survey, surveyId, refreshPending, runSync])

  const handleFieldChange = (field: string, value: string) => {
    if (!survey) return
    setSurvey({ ...survey, [field]: value })
    autoSave({ [field]: value })
  }

  const handleAddFloorPlan = async (mode: string) => {
    const name = mode === 'satellite' ? 'Satellite View'
      : mode === 'grid' ? 'Sketch Area'
      : mode === 'photos_only' ? 'Photo Survey'
      : `Area ${floorPlans.length + 1}`

    const res = await fetch(`/api/org/surveys/${surveyId}/floor-plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mode }),
    })
    if (res.ok) {
      const fp = await res.json()
      setFloorPlans(prev => [...prev, fp])
    }
  }

  const handleDeleteFloorPlan = async (fpId: string) => {
    if (!confirm('Delete this area and all its devices?')) return
    const res = await fetch(`/api/org/surveys/${surveyId}/floor-plans?fp_id=${fpId}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      setFloorPlans(prev => prev.filter(fp => fp.id !== fpId))
      setDevices(prev => prev.filter(d => d.floor_plan_id !== fpId))
      if (canvasFloorPlanId === fpId) setCanvasFloorPlanId(null)
    }
  }

  const handleSubmit = async () => {
    if (!confirm('Submit this survey? It will become read-only.')) return
    const res = await fetch(`/api/org/surveys/${surveyId}/submit`, { method: 'POST' })
    if (res.ok) {
      const updated = await res.json()
      setSurvey(prev => prev ? { ...prev, ...updated } : updated)
    } else {
      const err = await res.json()
      alert(err.error || 'Failed to submit')
    }
  }

  const handleExportToDesign = async () => {
    if (!confirm('Export this survey to a new Design? All floor plans and devices will be copied.')) return
    const res = await fetch(`/api/org/surveys/${surveyId}/export-to-design`, { method: 'POST' })
    if (res.ok) {
      const result = await res.json()
      alert(`Design created.\nAreas: ${result.areas_created}\nDevices: ${result.devices_copied}`)
      if (result.design_id) window.location.href = `/org/designs/${result.design_id}`
    } else {
      const err = await res.json()
      alert(err.error || 'Export failed')
    }
  }

  const handleInfraChanged = (updated: SurveyInfrastructure) => {
    setInfrastructure(prev => {
      const idx = prev.findIndex(i => i.id === updated.id)
      if (idx >= 0) return prev.map(i => i.id === updated.id ? updated : i)
      return [...prev, updated]
    })
  }

  if (loading || !survey) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const isSubmitted = survey.status === 'submitted'

  // ---- Canvas view (Screen 3) ----
  if (canvasFloorPlanId) {
    const activeFp = floorPlans.find(fp => fp.id === canvasFloorPlanId)
    const fpDevices = devices.filter(d => d.floor_plan_id === canvasFloorPlanId)
    if (!activeFp) {
      setCanvasFloorPlanId(null)
      return null
    }
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCanvasFloorPlanId(null)}
              className="inline-flex items-center gap-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="text-xs">Back to Survey</span>
            </button>
            <span className="text-muted-foreground">/</span>
            <span className="text-xs font-semibold text-foreground">{activeFp.name}</span>
          </div>
          {saving && <span className="text-[11px] text-muted-foreground animate-pulse">Saving...</span>}
        </div>
        <SurveyCanvas
          surveyId={surveyId}
          floorPlan={activeFp}
          devices={fpDevices}
          onDevicesChanged={setDevices}
          allDevices={devices}
          readOnly={isSubmitted}
        />
      </div>
    )
  }

  // ---- Overview view (Screen 2) ----
  return (
    <div className="flex flex-col gap-3 p-4 max-w-5xl mx-auto">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="rounded p-1 hover:bg-muted">
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <span className="text-sm font-semibold text-foreground">
            {survey.site_name || 'Untitled Survey'}
          </span>
          <SurveyStatusBadge status={survey.status} />
          {!online && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
              <WifiOff className="h-3 w-3" /> Offline
            </span>
          )}
          {online && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Wifi className="h-3 w-3" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {saving && <span className="text-[11px] text-muted-foreground animate-pulse">Saving...</span>}
          {!isSubmitted && (
            <button
              onClick={handleSubmit}
              className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
            >
              <Send className="h-3 w-3" /> Submit Survey
            </button>
          )}
          {isSubmitted && (
            <button
              onClick={handleExportToDesign}
              className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 transition-colors"
            >
              Export to Design
            </button>
          )}
        </div>
      </div>

      {/* Sync Banner */}
      {pendingCount > 0 && (
        <div className="flex items-center justify-between rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
            {pendingCount} pending change{pendingCount === 1 ? '' : 's'} not yet synced
            {!online && ' — will sync when online'}
          </span>
          {online && (
            <button
              onClick={runSync}
              disabled={syncing}
              className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync now'}
            </button>
          )}
        </div>
      )}

      {/* Site Information */}
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" /> Site Information
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-0.5">Site Name</label>
            <input
              value={survey.site_name || ''}
              onChange={(e) => handleFieldChange('site_name', e.target.value)}
              disabled={isSubmitted}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-0.5">OPP Number</label>
            <input
              value={survey.opp_id || ''}
              disabled
              placeholder="Linked on create"
              className="w-full rounded border border-border bg-muted px-2 py-1.5 text-xs text-muted-foreground outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-0.5">Customer / District</label>
            <input
              value={survey.customer_name || ''}
              onChange={(e) => handleFieldChange('customer_name', e.target.value)}
              disabled={isSubmitted}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-0.5">Survey Date</label>
            <input
              type="date"
              value={survey.survey_date || ''}
              onChange={(e) => handleFieldChange('survey_date', e.target.value)}
              disabled={isSubmitted}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary disabled:opacity-50"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-[11px] font-medium text-muted-foreground mb-0.5">Project Location (address)</label>
            <input
              value={survey.site_address || ''}
              onChange={(e) => handleFieldChange('site_address', e.target.value)}
              disabled={isSubmitted}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-0.5">Surveyor Name</label>
            <input
              value={survey.surveyor_name || ''}
              onChange={(e) => handleFieldChange('surveyor_name', e.target.value)}
              disabled={isSubmitted}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary disabled:opacity-50"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-[11px] font-medium text-muted-foreground mb-0.5">General Site Observations</label>
            <textarea
              value={survey.site_notes || ''}
              onChange={(e) => handleFieldChange('site_notes', e.target.value)}
              disabled={isSubmitted}
              rows={3}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary disabled:opacity-50 resize-none"
            />
          </div>
        </div>
      </section>

      {/* Floor Plans & Areas */}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" /> Floor Plans & Areas
          </h2>
          {!isSubmitted && (
            <div className="relative">
              <button
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-3 w-3" /> Add
              </button>
              {showAddMenu && (
                <div className="absolute right-0 top-full z-20 mt-1">
                  <div className="rounded-md border border-border bg-popover shadow-md py-1 min-w-[180px]">
                    {SURVEY_FLOOR_PLAN_MODES.map((m) => (
                      <button
                        key={m.value}
                        onClick={() => { handleAddFloorPlan(m.value); setShowAddMenu(false) }}
                        className="block w-full px-3 py-1.5 text-left text-xs text-foreground hover:bg-accent"
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {floorPlans.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-8">
            <Layers className="mb-2 h-6 w-6 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">No areas added yet</p>
            {!isSubmitted && (
              <p className="mt-1 text-[11px] text-muted-foreground/60">
                Click &quot;Add&quot; to create a floor plan or satellite area
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          {floorPlans.map((fp) => {
            const fpDeviceCount = devices.filter(d => d.floor_plan_id === fp.id).length
            const fpInfra = infrastructure.find(i => i.floor_plan_id === fp.id) ?? null
            const isExpanded = expandedInfraId === fp.id
            const modeLabel = SURVEY_FLOOR_PLAN_MODES.find(m => m.value === fp.mode)?.label ?? fp.mode

            return (
              <div key={fp.id} className="rounded-lg border border-border">
                <div className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <button
                      onClick={() => setExpandedInfraId(isExpanded ? null : fp.id)}
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                    <span className="text-xs font-semibold text-foreground truncate">{fp.name}</span>
                    <span className="text-[10px] text-muted-foreground">{modeLabel}</span>
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <Camera className="h-3 w-3" /> {fpDeviceCount}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCanvasFloorPlanId(fp.id)}
                      className="rounded-md bg-sky-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-sky-700"
                    >
                      Open Canvas
                    </button>
                    {!isSubmitted && (
                      <button
                        onClick={() => handleDeleteFloorPlan(fp.id)}
                        className="rounded p-1 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-border bg-background/40">
                    <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Infrastructure Observations
                    </div>
                    <SurveyInfrastructurePanel
                      surveyId={surveyId}
                      floorPlanId={fp.id}
                      floorPlanName={fp.name}
                      infrastructure={fpInfra}
                      onChanged={handleInfraChanged}
                      readOnly={isSubmitted}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Device Summary */}
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-xs font-semibold text-foreground mb-3">Device Summary</h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {(['cctv', 'access_control', 'network', 'av', 'vape_environmental', 'other'] as const).map((sys) => {
            const count = devices.filter(d => d.system_type === sys).length
            const label = sys === 'cctv' ? 'CCTV'
              : sys === 'access_control' ? 'ACS'
              : sys === 'network' ? 'Network'
              : sys === 'av' ? 'AV'
              : sys === 'vape_environmental' ? 'Vape/Env'
              : 'Other'
            return (
              <div key={sys} className="text-center rounded border border-border p-2">
                <p className="text-lg font-bold text-foreground">{count}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </div>
            )
          })}
        </div>
        <div className="mt-3 text-center text-[11px] text-muted-foreground">
          Total: <span className="font-semibold text-foreground">{devices.length}</span> devices
        </div>
      </section>
    </div>
  )
}
