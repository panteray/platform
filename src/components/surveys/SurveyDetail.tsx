'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ArrowLeft, Save, Send, Plus, Trash2, MapPin, Layers,
  ChevronDown, ChevronUp, Wifi, WifiOff, RefreshCw,
} from 'lucide-react'
import { C } from '../design-canvas/constants'
import type { Survey, SurveyFloorPlan, SurveyDevice, SurveyInfrastructure } from '@/types/database'
import { SurveyStatusBadge } from './SurveyStatusBadge'
import { SURVEY_FLOOR_PLAN_MODES, SURVEY_INFRA_TYPES } from '@/lib/survey-constants'
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
  const [activeFloorPlan, setActiveFloorPlan] = useState<string | null>(null)
  const [showInfo, setShowInfo] = useState(true)
  const [showInfra, setShowInfra] = useState(false)
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

  // Online/offline detection + auto-sync on reconnect
  useEffect(() => {
    const handleOnline = () => {
      setOnline(true)
      runSync()
    }
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
      if (data.survey_floor_plans?.length > 0 && !activeFloorPlan) {
        setActiveFloorPlan(data.survey_floor_plans[0].id)
      }
    }
    setLoading(false)
  }, [surveyId, activeFloorPlan])

  useEffect(() => { load() }, [load])

  // Auto-save with debounce — write-first to IndexedDB, then push to server
  const autoSave = useCallback(async (updates: Partial<Survey>) => {
    if (!survey || survey.status === 'submitted') return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSaving(true)
      // Write-first: mirror to IndexedDB + queue a sync entry
      try {
        await putLocal('surveys', { ...survey, ...updates, id: surveyId } as Record<string, unknown> & { id: string })
        await refreshPending()
      } catch {
        // non-fatal — offline DB unavailable (SSR or private mode)
      }
      // Push to server if online
      if (navigator.onLine) {
        const res = await fetch(`/api/org/surveys/${surveyId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })
        if (res.ok) {
          const updated = await res.json()
          setSurvey(prev => prev ? { ...prev, ...updated } : updated)
          // Successful write — drain any earlier queued mutations
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
      setActiveFloorPlan(fp.id)
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
      if (activeFloorPlan === fpId) {
        setActiveFloorPlan(floorPlans.find(fp => fp.id !== fpId)?.id || null)
      }
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
      if (result.design_id) {
        window.location.href = `/org/designs/${result.design_id}`
      }
    } else {
      const err = await res.json()
      alert(err.error || 'Export failed')
    }
  }

  const handleDevicesChanged = (updated: SurveyDevice[]) => {
    setDevices(updated)
  }

  if (loading || !survey) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const isSubmitted = survey.status === 'submitted'
  const activeFp = floorPlans.find(fp => fp.id === activeFloorPlan)
  const fpDevices = devices.filter(d => d.floor_plan_id === activeFloorPlan)

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] gap-2">
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

      {/* Sync Banner — pending offline writes */}
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

      {/* Survey Info — Collapsible */}
      <div className="rounded-lg border border-border bg-card">
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-foreground"
        >
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> Site Information
          </span>
          {showInfo ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {showInfo && (
          <div className="border-t border-border px-3 py-3 grid grid-cols-2 gap-3">
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
              <label className="block text-[11px] font-medium text-muted-foreground mb-0.5">Site Address</label>
              <input
                value={survey.site_address || ''}
                onChange={(e) => handleFieldChange('site_address', e.target.value)}
                disabled={isSubmitted}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-0.5">Customer</label>
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
              <label className="block text-[11px] font-medium text-muted-foreground mb-0.5">Site Notes</label>
              <textarea
                value={survey.site_notes || ''}
                onChange={(e) => handleFieldChange('site_notes', e.target.value)}
                disabled={isSubmitted}
                rows={2}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary disabled:opacity-50 resize-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Floor Plan Tabs */}
      <div className="rounded-lg border border-border bg-card flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex items-center gap-1 px-2 py-1.5 overflow-x-auto scrollbar-hide" style={{ background: C.bgPanel, borderBottom: `1px solid ${C.border}` }}>
          {floorPlans.map((fp) => (
            <div key={fp.id} className="flex items-center gap-0.5">
              <button
                onClick={() => setActiveFloorPlan(fp.id)}
                className={`whitespace-nowrap rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                  activeFloorPlan === fp.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {fp.name}
              </button>
              {!isSubmitted && (
                <button
                  onClick={() => handleDeleteFloorPlan(fp.id)}
                  className="rounded p-0.5 text-muted-foreground/40 hover:text-destructive"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          ))}
          {!isSubmitted && (
            <div className="relative">
              <button
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="flex items-center gap-0.5 rounded px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-3 w-3" /> Add Area
              </button>
              {showAddMenu && (
                <div className="absolute left-0 top-full z-20 pt-1">
                  <div className="rounded-md border border-border bg-popover shadow-md py-1 min-w-[160px]">
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

        {/* Canvas Area */}
        {activeFp ? (
          <SurveyCanvas
            surveyId={surveyId}
            floorPlan={activeFp}
            devices={fpDevices}
            onDevicesChanged={handleDevicesChanged}
            allDevices={devices}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-16">
            <Layers className="mb-2 h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No areas added yet</p>
            {!isSubmitted && (
              <p className="mt-1 text-xs text-muted-foreground/60">
                Click &quot;+ Add Area&quot; to start documenting
              </p>
            )}
          </div>
        )}
      </div>

      {/* Infrastructure Panel — Collapsible */}
      <div className="rounded-lg border border-border bg-card">
        <button
          onClick={() => setShowInfra(!showInfra)}
          className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-foreground"
        >
          <span>Infrastructure ({infrastructure.length})</span>
          {showInfra ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {showInfra && (
          <SurveyInfrastructurePanel
            surveyId={surveyId}
            infrastructure={infrastructure}
            onChanged={setInfrastructure}
            readOnly={isSubmitted}
          />
        )}
      </div>

      {/* Device Summary */}
      <div className="rounded-lg border border-border bg-card p-3">
        <h4 className="text-xs font-semibold text-foreground mb-2">Device Summary</h4>
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
      </div>
    </div>
  )
}
