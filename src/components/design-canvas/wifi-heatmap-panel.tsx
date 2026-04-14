'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Wifi, Plus, Trash2, Play, RotateCcw, ChevronDown, ChevronUp,
  Signal, AlertTriangle, Radio, Zap,
} from 'lucide-react'
import type { DesignWifiAp } from '@/types/database'
import {
  runWifiHeatmap,
  validateHeatmapInput,
  RSSI_THRESHOLDS,
  type WifiApInput,
  type WallInput,
  type HeatmapOutput,
  type HeatmapConfig,
  type Environment,
} from '@/lib/calculators/wifi-heatmap'

// ---- Types ----

interface Props {
  designId: string
  areaId?: string
  walls?: Array<{ id: string; x1: number; y1: number; x2: number; y2: number; material?: string }>
  canvasWidth: number
  canvasHeight: number
  scalePxPerFt: number
  onHeatmapGenerated?: (output: HeatmapOutput | null) => void
}

const BANDS = ['2.4', '5', '6', 'dual', 'tri'] as const
const ENVIRONMENTS: Environment[] = ['office', 'warehouse', 'outdoor', 'classroom', 'hospital']
const CHANNEL_WIDTHS = [20, 40, 80, 160]

const ENV_LABELS: Record<Environment, string> = {
  office: 'Office',
  warehouse: 'Warehouse',
  outdoor: 'Outdoor',
  classroom: 'Classroom',
  hospital: 'Hospital',
}

// ---- Component ----

export function WifiHeatmapPanel({
  designId,
  areaId,
  walls = [],
  canvasWidth,
  canvasHeight,
  scalePxPerFt,
  onHeatmapGenerated,
}: Props) {
  const [aps, setAps] = useState<DesignWifiAp[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedApId, setSelectedApId] = useState<string | null>(null)
  const [heatmapResult, setHeatmapResult] = useState<HeatmapOutput | null>(null)
  const [showConfig, setShowConfig] = useState(false)
  const [gridRes, setGridRes] = useState(16)
  const [targetBand, setTargetBand] = useState<'2.4' | '5' | '6'>('5')
  const [errors, setErrors] = useState<string[]>([])

  // ---- Load APs ----
  const loadAps = useCallback(async () => {
    const url = areaId
      ? `/api/org/designs/${designId}/wifi-aps?area_id=${areaId}`
      : `/api/org/designs/${designId}/wifi-aps`
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      setAps(data.wifi_aps ?? [])
    }
    setLoading(false)
  }, [designId, areaId])

  useEffect(() => { loadAps() }, [loadAps])

  // ---- CRUD ----
  const createAp = async () => {
    setSaving(true)
    const label = `AP-${String(aps.length + 1).padStart(2, '0')}`
    const res = await fetch(`/api/org/designs/${designId}/wifi-aps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        area_id: areaId || null,
        label,
        band: 'dual',
        channel_width: 40,
        tx_power_dbm: 20,
        antenna_gain_dbi: 3,
        mount_height_ft: 10,
        environment: 'office',
        position_x: canvasWidth / 2,
        position_y: canvasHeight / 2,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setAps(prev => [...prev, data.wifi_ap])
      setSelectedApId(data.wifi_ap.id)
    }
    setSaving(false)
  }

  const updateAp = async (apId: string, fields: Partial<DesignWifiAp>) => {
    const res = await fetch(`/api/org/designs/${designId}/wifi-aps?ap_id=${apId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    })
    if (res.ok) {
      const data = await res.json()
      setAps(prev => prev.map(a => a.id === apId ? data.wifi_ap : a))
    }
  }

  const deleteAp = async (apId: string) => {
    if (!confirm('Delete this access point?')) return
    const res = await fetch(`/api/org/designs/${designId}/wifi-aps?ap_id=${apId}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      setAps(prev => prev.filter(a => a.id !== apId))
      if (selectedApId === apId) setSelectedApId(null)
    }
  }

  // ---- Heatmap Calculation ----
  const wallInputs: WallInput[] = useMemo(() =>
    walls.map(w => ({
      id: w.id,
      x1: w.x1,
      y1: w.y1,
      x2: w.x2,
      y2: w.y2,
      material: (w.material as WallInput['material']) || 'drywall',
    })),
    [walls]
  )

  const runHeatmap = useCallback(() => {
    if (aps.length === 0) {
      setErrors(['Place at least one access point first'])
      return
    }

    const apInputs: WifiApInput[] = aps.map(ap => ({
      id: ap.id,
      label: ap.label,
      position_x: ap.position_x,
      position_y: ap.position_y,
      band: ap.band as WifiApInput['band'],
      channel: ap.channel,
      channel_width: ap.channel_width,
      tx_power_dbm: ap.tx_power_dbm,
      antenna_gain_dbi: ap.antenna_gain_dbi,
      mount_height_ft: ap.mount_height_ft,
      environment: ap.environment as Environment,
      ap_model: ap.ap_model ?? undefined,
      vendor: ap.vendor ?? undefined,
    }))

    const config: HeatmapConfig = {
      gridResolution: gridRes,
      canvasWidth,
      canvasHeight,
      scalePxPerFt,
      targetBand,
    }

    const input = { aps: apInputs, walls: wallInputs, config }
    const validationErrors = validateHeatmapInput(input)
    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }

    setErrors([])
    const result = runWifiHeatmap(input)
    setHeatmapResult(result)
    onHeatmapGenerated?.(result)
  }, [aps, wallInputs, gridRes, canvasWidth, canvasHeight, scalePxPerFt, targetBand, onHeatmapGenerated])

  const clearHeatmap = () => {
    setHeatmapResult(null)
    onHeatmapGenerated?.(null)
  }

  const selectedAp = aps.find(a => a.id === selectedApId) ?? null

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wifi className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">WiFi Heatmap</h3>
          <span className="text-[10px] text-muted-foreground">({aps.length} APs)</span>
        </div>
        <button
          onClick={createAp}
          disabled={saving}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-3 w-3" /> Add AP
        </button>
      </div>

      {/* AP List */}
      {aps.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-8">
          <Radio className="mb-2 h-6 w-6 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">No access points placed</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground/60">Add an AP to begin heatmap analysis</p>
        </div>
      ) : (
        <div className="space-y-1">
          {aps.map(ap => (
            <button
              key={ap.id}
              onClick={() => setSelectedApId(selectedApId === ap.id ? null : ap.id)}
              className={`flex w-full items-center justify-between rounded-md border px-2.5 py-1.5 text-left transition-colors ${
                selectedApId === ap.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-accent/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: ap.color_hex ?? '#3b82f6' }}
                />
                <span className="text-xs font-medium text-foreground">{ap.label}</span>
                <span className="text-[10px] text-muted-foreground">
                  {ap.band} · {ap.tx_power_dbm}dBm · Ch{ap.channel ?? '—'}
                </span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); deleteAp(ap.id) }}
                className="rounded p-0.5 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </button>
          ))}
        </div>
      )}

      {/* Selected AP Editor */}
      {selectedAp && (
        <div className="space-y-2 rounded-lg border border-border bg-card p-3">
          <h4 className="text-[11px] font-semibold text-foreground">{selectedAp.label} — Settings</h4>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Label">
              <input
                value={selectedAp.label}
                onChange={e => updateAp(selectedAp.id, { label: e.target.value })}
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
              />
            </Field>
            <Field label="Vendor">
              <input
                value={selectedAp.vendor ?? ''}
                onChange={e => updateAp(selectedAp.id, { vendor: e.target.value })}
                placeholder="e.g. Meraki, Ubiquiti"
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
              />
            </Field>
            <Field label="Model">
              <input
                value={selectedAp.ap_model ?? ''}
                onChange={e => updateAp(selectedAp.id, { ap_model: e.target.value })}
                placeholder="e.g. MR46"
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
              />
            </Field>
            <Field label="Band">
              <select
                value={selectedAp.band}
                onChange={e => updateAp(selectedAp.id, { band: e.target.value })}
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
              >
                {BANDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>
            <Field label="Channel">
              <input
                type="number"
                value={selectedAp.channel ?? ''}
                onChange={e => updateAp(selectedAp.id, { channel: e.target.value ? Number(e.target.value) : null })}
                placeholder="Auto"
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
              />
            </Field>
            <Field label="Ch Width (MHz)">
              <select
                value={selectedAp.channel_width}
                onChange={e => updateAp(selectedAp.id, { channel_width: Number(e.target.value) })}
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
              >
                {CHANNEL_WIDTHS.map(w => <option key={w} value={w}>{w} MHz</option>)}
              </select>
            </Field>
            <Field label="TX Power (dBm)">
              <input
                type="number"
                value={selectedAp.tx_power_dbm}
                onChange={e => updateAp(selectedAp.id, { tx_power_dbm: Number(e.target.value) })}
                min={0}
                max={30}
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
              />
            </Field>
            <Field label="Antenna Gain (dBi)">
              <input
                type="number"
                value={selectedAp.antenna_gain_dbi}
                onChange={e => updateAp(selectedAp.id, { antenna_gain_dbi: Number(e.target.value) })}
                min={0}
                max={15}
                step={0.5}
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
              />
            </Field>
            <Field label="Mount Height (ft)">
              <input
                type="number"
                value={selectedAp.mount_height_ft}
                onChange={e => updateAp(selectedAp.id, { mount_height_ft: Number(e.target.value) })}
                min={1}
                max={50}
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
              />
            </Field>
            <Field label="Environment">
              <select
                value={selectedAp.environment}
                onChange={e => updateAp(selectedAp.id, { environment: e.target.value })}
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
              >
                {ENVIRONMENTS.map(env => (
                  <option key={env} value={env}>{ENV_LABELS[env]}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Notes">
            <textarea
              value={selectedAp.notes ?? ''}
              onChange={e => updateAp(selectedAp.id, { notes: e.target.value })}
              rows={2}
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary resize-none"
              placeholder="Optional notes..."
            />
          </Field>
        </div>
      )}

      {/* Heatmap Config */}
      <div>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="flex w-full items-center justify-between rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent/50"
        >
          <span>Heatmap Settings</span>
          {showConfig ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {showConfig && (
          <div className="mt-1.5 space-y-2 rounded-md border border-border bg-card p-2.5">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Grid Resolution (px)">
                <input
                  type="number"
                  value={gridRes}
                  onChange={e => setGridRes(Math.max(2, Number(e.target.value)))}
                  min={2}
                  max={64}
                  className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
                />
              </Field>
              <Field label="Target Band">
                <select
                  value={targetBand}
                  onChange={e => setTargetBand(e.target.value as '2.4' | '5' | '6')}
                  className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
                >
                  <option value="2.4">2.4 GHz</option>
                  <option value="5">5 GHz</option>
                  <option value="6">6 GHz</option>
                </select>
              </Field>
            </div>
            <p className="text-[9px] text-muted-foreground">
              Lower grid resolution = more detail but slower. 16px recommended.
            </p>
          </div>
        )}
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="rounded-md border border-destructive/20 bg-destructive/5 p-2.5">
          {errors.map((err, i) => (
            <p key={i} className="flex items-start gap-1.5 text-[11px] text-destructive">
              <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
              {err}
            </p>
          ))}
        </div>
      )}

      {/* Run / Clear Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={runHeatmap}
          disabled={aps.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Play className="h-3 w-3" /> Generate Heatmap
        </button>
        {heatmapResult && (
          <button
            onClick={clearHeatmap}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent"
          >
            <RotateCcw className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      {/* Results */}
      {heatmapResult && (
        <div className="space-y-2">
          <h4 className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
            <Signal className="h-3.5 w-3.5 text-primary" />
            Coverage Results
          </h4>

          {/* Coverage Bar */}
          <div className="rounded-md border border-border bg-card p-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-medium text-muted-foreground">Coverage (&#8805; -70 dBm)</span>
              <span className={`text-sm font-bold ${
                heatmapResult.summary.coveragePct >= 90 ? 'text-emerald-500' :
                heatmapResult.summary.coveragePct >= 70 ? 'text-amber-500' : 'text-destructive'
              }`}>
                {heatmapResult.summary.coveragePct}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  heatmapResult.summary.coveragePct >= 90 ? 'bg-emerald-500' :
                  heatmapResult.summary.coveragePct >= 70 ? 'bg-amber-500' : 'bg-destructive'
                }`}
                style={{ width: `${Math.min(100, heatmapResult.summary.coveragePct)}%` }}
              />
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-1.5">
            <StatCard label="Excellent" value={heatmapResult.summary.excellentCells} color="text-emerald-500" threshold={`${RSSI_THRESHOLDS.excellent} dBm`} />
            <StatCard label="Good" value={heatmapResult.summary.goodCells} color="text-lime-500" threshold={`${RSSI_THRESHOLDS.good} dBm`} />
            <StatCard label="Fair" value={heatmapResult.summary.fairCells} color="text-amber-500" threshold={`${RSSI_THRESHOLDS.fair} dBm`} />
            <StatCard label="Poor" value={heatmapResult.summary.poorCells} color="text-orange-500" threshold={`${RSSI_THRESHOLDS.poor} dBm`} />
            <StatCard label="Dead" value={heatmapResult.summary.deadCells} color="text-destructive" threshold="< -80 dBm" />
            <StatCard label="Avg RSSI" value={`${heatmapResult.summary.avgRssi}`} color="text-foreground" threshold="dBm" />
          </div>

          {/* Per-AP Coverage */}
          <div className="space-y-1">
            <h5 className="text-[10px] font-semibold text-muted-foreground uppercase">Per Access Point</h5>
            {heatmapResult.perAp.map(ap => (
              <div key={ap.apId} className="flex items-center justify-between rounded border border-border px-2 py-1.5">
                <div>
                  <span className="text-[11px] font-medium text-foreground">{ap.label}</span>
                  <span className="ml-2 text-[10px] text-muted-foreground">
                    {ap.primaryCells} primary cells · ~{ap.maxRange_ft} ft range
                  </span>
                </div>
                {ap.channelConflicts.length > 0 && (
                  <span className="flex items-center gap-0.5 text-[10px] text-amber-500">
                    <Zap className="h-2.5 w-2.5" />
                    {ap.channelConflicts.length} conflict{ap.channelConflicts.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-muted-foreground">Signal:</span>
            <div className="flex items-center gap-0.5">
              <div className="h-2 w-4 rounded-sm bg-emerald-500" />
              <div className="h-2 w-4 rounded-sm bg-lime-500" />
              <div className="h-2 w-4 rounded-sm bg-yellow-500" />
              <div className="h-2 w-4 rounded-sm bg-orange-500" />
              <div className="h-2 w-4 rounded-sm bg-red-600" />
              <div className="h-2 w-4 rounded-sm bg-red-950" />
            </div>
            <span className="text-[9px] text-muted-foreground">Strong → Dead</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ---- Sub-components ----

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">{label}</label>
      {children}
    </div>
  )
}

function StatCard({ label, value, color, threshold }: {
  label: string
  value: number | string
  color: string
  threshold: string
}) {
  return (
    <div className="rounded border border-border bg-background p-1.5 text-center">
      <p className={`text-sm font-bold ${color}`}>{value}</p>
      <p className="text-[9px] font-medium text-foreground">{label}</p>
      <p className="text-[8px] text-muted-foreground">{threshold}</p>
    </div>
  )
}
