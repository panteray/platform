'use client'

import { useState, useRef, useCallback } from 'react'
import { X, Trash2, Camera, ChevronDown, ChevronUp } from 'lucide-react'
import type { SurveyDevice } from '@/types/database'
import {
  SURVEY_SYSTEM_TYPES, SURVEY_DEVICE_TYPES, SURVEY_DEVICE_STATUSES,
  SURVEY_CONDITIONS, SURVEY_MOUNT_TYPES, SURVEY_CABLE_TYPES,
  SURVEY_RESOLUTIONS, VAPE_DETECTION_CAPABILITIES,
  DOOR_TYPES, LOCK_TYPES,
} from '@/lib/survey-constants'

interface Props {
  device: SurveyDevice
  surveyId: string
  onUpdate: (updates: Partial<SurveyDevice>) => void
  onDelete: () => void
  onClose: () => void
  readOnly?: boolean
}

export function SurveyDevicePanel({ device, surveyId, onUpdate, onDelete, onClose, readOnly }: Props) {
  const [showDoor, setShowDoor] = useState(false)
  const [showVape, setShowVape] = useState(false)
  const [photoCapturing, setPhotoCapturing] = useState(false)
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const debouncedUpdate = useCallback((field: string, value: unknown) => {
    if (debounceRef.current[field]) clearTimeout(debounceRef.current[field])
    debounceRef.current[field] = setTimeout(() => {
      onUpdate({ [field]: value } as Partial<SurveyDevice>)
    }, 600)
  }, [onUpdate])

  const deviceTypes = SURVEY_DEVICE_TYPES[device.system_type as keyof typeof SURVEY_DEVICE_TYPES] || []
  const systemLabel = SURVEY_SYSTEM_TYPES.find(s => s.value === device.system_type)?.label || device.system_type
  const deviceTypeLabel = deviceTypes.find(d => d.value === device.device_type)?.label || device.device_type

  // Photo capture — auto-captures GPS lat/lng if available (G8)
  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoCapturing(true)

    // Kick off GPS fetch in parallel with file read
    const gpsPromise = new Promise<{ lat: number | null; lng: number | null }>((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        resolve({ lat: null, lng: null })
        return
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve({ lat: null, lng: null }),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
      )
    })

    const reader = new FileReader()
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string
      const gps = await gpsPromise
      await fetch(`/api/org/surveys/${surveyId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: device.id,
          base64,
          caption: `${device.label} — ${deviceTypeLabel}`,
          lat: gps.lat,
          lng: gps.lng,
        }),
      })
      setPhotoCapturing(false)
    }
    reader.readAsDataURL(file)
  }

  // Door config helpers — IPVM expanded panel
  const dcfg = (device.door_config || {}) as Record<string, unknown>
  const setDoor = (patch: Record<string, unknown>) => {
    onUpdate({ door_config: { ...dcfg, ...patch } })
  }

  return (
    <div className="w-64 border-l border-border bg-card overflow-y-auto" style={{ maxHeight: 600 }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div>
          <p className="text-xs font-semibold text-foreground">{device.label}</p>
          <p className="text-[10px] text-muted-foreground">{systemLabel} — {deviceTypeLabel}</p>
        </div>
        <div className="flex items-center gap-1">
          {!readOnly && (
            <button onClick={onDelete} className="rounded p-1 text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-3 p-3">
        {/* Status & Condition */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Status</label>
            <select
              value={device.status}
              onChange={(e) => onUpdate({ status: e.target.value as SurveyDevice['status'] })}
              disabled={readOnly}
              className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] outline-none focus:border-primary disabled:opacity-50"
            >
              {SURVEY_DEVICE_STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Condition</label>
            <select
              value={device.condition || 'unknown'}
              onChange={(e) => onUpdate({ condition: e.target.value as SurveyDevice['condition'] })}
              disabled={readOnly}
              className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] outline-none focus:border-primary disabled:opacity-50"
            >
              {SURVEY_CONDITIONS.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Existing Make/Model (for existing_keep / existing_remove) */}
        {(device.status === 'existing_keep' || device.status === 'existing_remove') && (
          <div>
            <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Existing Make/Model</label>
            <input
              defaultValue={device.existing_make_model || ''}
              onChange={(e) => debouncedUpdate('existing_make_model', e.target.value)}
              disabled={readOnly}
              className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] outline-none focus:border-primary disabled:opacity-50"
            />
          </div>
        )}

        {/* Location Description */}
        <div>
          <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Location</label>
          <input
            defaultValue={device.location_description || ''}
            onChange={(e) => debouncedUpdate('location_description', e.target.value)}
            disabled={readOnly}
            placeholder="e.g. Main lobby, NW corner"
            className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] outline-none focus:border-primary disabled:opacity-50"
          />
        </div>

        {/* Vendor & Model */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Vendor</label>
            <input
              defaultValue={device.vendor || ''}
              onChange={(e) => debouncedUpdate('vendor', e.target.value)}
              disabled={readOnly}
              className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] outline-none focus:border-primary disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Model</label>
            <input
              defaultValue={device.model || ''}
              onChange={(e) => debouncedUpdate('model', e.target.value)}
              disabled={readOnly}
              className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] outline-none focus:border-primary disabled:opacity-50"
            />
          </div>
        </div>

        {/* Resolution (CCTV only) */}
        {device.system_type === 'cctv' && (
          <div>
            <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Resolution</label>
            <select
              value={device.resolution || ''}
              onChange={(e) => onUpdate({ resolution: e.target.value || null })}
              disabled={readOnly}
              className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] outline-none focus:border-primary disabled:opacity-50"
            >
              <option value="">—</option>
              {SURVEY_RESOLUTIONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        )}

        {/* Mount Type & Height */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Mount</label>
            <select
              value={device.mount_type || ''}
              onChange={(e) => onUpdate({ mount_type: e.target.value || null })}
              disabled={readOnly}
              className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] outline-none focus:border-primary disabled:opacity-50"
            >
              <option value="">—</option>
              {SURVEY_MOUNT_TYPES.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Height (in)</label>
            <input
              type="number"
              defaultValue={device.mount_height_in || ''}
              onChange={(e) => debouncedUpdate('mount_height_in', e.target.value ? Number(e.target.value) : null)}
              disabled={readOnly}
              className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] outline-none focus:border-primary disabled:opacity-50"
            />
          </div>
        </div>

        {/* Cable Type & Run */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Cable</label>
            <select
              value={device.cable_type || ''}
              onChange={(e) => onUpdate({ cable_type: e.target.value || null })}
              disabled={readOnly}
              className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] outline-none focus:border-primary disabled:opacity-50"
            >
              <option value="">—</option>
              {SURVEY_CABLE_TYPES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Run (ft)</label>
            <input
              type="number"
              defaultValue={device.cable_run_ft || ''}
              onChange={(e) => debouncedUpdate('cable_run_ft', e.target.value ? Number(e.target.value) : null)}
              disabled={readOnly}
              className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] outline-none focus:border-primary disabled:opacity-50"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Notes</label>
          <textarea
            defaultValue={device.notes || ''}
            onChange={(e) => debouncedUpdate('notes', e.target.value)}
            disabled={readOnly}
            rows={2}
            className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] outline-none focus:border-primary disabled:opacity-50 resize-none"
          />
        </div>

        {/* Photo Capture */}
        <div>
          <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent">
            <Camera className="h-3 w-3" />
            {photoCapturing ? 'Uploading...' : 'Take Photo'}
            <input type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="hidden" disabled={readOnly || photoCapturing} />
          </label>
        </div>

        {/* ACS Door Config — Collapsible */}
        {device.system_type === 'access_control' && (
          <div className="rounded border border-border">
            <button
              onClick={() => setShowDoor(!showDoor)}
              className="flex w-full items-center justify-between px-2 py-1.5 text-[10px] font-semibold text-foreground"
            >
              Door Configuration
              {showDoor ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {showDoor && (
              <div className="border-t border-border px-2 py-2 space-y-2">
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-0.5">Door Type</label>
                  <select
                    value={(dcfg.door_type as string) || ''}
                    onChange={(e) => setDoor({ door_type: e.target.value })}
                    disabled={readOnly}
                    className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] outline-none"
                  >
                    <option value="">—</option>
                    {DOOR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-0.5">Lock Type</label>
                  <select
                    value={(dcfg.lock_type as string) || ''}
                    onChange={(e) => setDoor({ lock_type: e.target.value })}
                    disabled={readOnly}
                    className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] outline-none"
                  >
                    <option value="">—</option>
                    {LOCK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {/* Readers count + entry/exit + credential types */}
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-0.5">Readers</label>
                  <div className="grid grid-cols-2 gap-1">
                    <input
                      type="number"
                      min={0}
                      value={(dcfg.reader_count as number) ?? 0}
                      onChange={(e) => setDoor({ reader_count: Number(e.target.value) || 0 })}
                      disabled={readOnly}
                      placeholder="Count"
                      className="rounded border border-border bg-background px-1.5 py-1 text-[11px] outline-none"
                    />
                    <select
                      value={(dcfg.reader_cred as string) || ''}
                      onChange={(e) => setDoor({ reader_cred: e.target.value })}
                      disabled={readOnly}
                      className="rounded border border-border bg-background px-1.5 py-1 text-[11px] outline-none"
                    >
                      <option value="">Credential</option>
                      <option value="prox">Prox 125kHz</option>
                      <option value="smartcard">Smartcard 13.56</option>
                      <option value="mobile">Mobile/BLE</option>
                      <option value="biometric">Biometric</option>
                      <option value="keypad">PIN Keypad</option>
                      <option value="multi">Multi-tech</option>
                    </select>
                  </div>
                  <div className="mt-1 flex gap-2 text-[10px] text-foreground">
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={!!dcfg.reader_in}
                        onChange={(e) => setDoor({ reader_in: e.target.checked })}
                        disabled={readOnly}
                        className="h-3 w-3"
                      /> IN
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={!!dcfg.reader_out}
                        onChange={(e) => setDoor({ reader_out: e.target.checked })}
                        disabled={readOnly}
                        className="h-3 w-3"
                      /> OUT
                    </label>
                  </div>
                </div>

                {/* Outputs — lock / opener / aux */}
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-0.5">Outputs</label>
                  <div className="grid grid-cols-3 gap-1 text-[10px] text-foreground">
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={!!dcfg.out_lock} onChange={(e) => setDoor({ out_lock: e.target.checked })} disabled={readOnly} className="h-3 w-3" /> Lock
                    </label>
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={!!dcfg.out_opener} onChange={(e) => setDoor({ out_opener: e.target.checked })} disabled={readOnly} className="h-3 w-3" /> Opener
                    </label>
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={!!dcfg.out_aux} onChange={(e) => setDoor({ out_aux: e.target.checked })} disabled={readOnly} className="h-3 w-3" /> Aux
                    </label>
                  </div>
                </div>

                {/* Inputs — REX / contacts / aux */}
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-0.5">Inputs</label>
                  <div className="grid grid-cols-3 gap-1 text-[10px] text-foreground">
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={!!dcfg.in_rex} onChange={(e) => setDoor({ in_rex: e.target.checked })} disabled={readOnly} className="h-3 w-3" /> REX
                    </label>
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={!!dcfg.in_contact} onChange={(e) => setDoor({ in_contact: e.target.checked })} disabled={readOnly} className="h-3 w-3" /> Contact
                    </label>
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={!!dcfg.in_aux} onChange={(e) => setDoor({ in_aux: e.target.checked })} disabled={readOnly} className="h-3 w-3" /> Aux
                    </label>
                  </div>
                </div>

                {/* External Tamper / DPS / ADA */}
                <div className="grid grid-cols-1 gap-1 text-[10px] text-foreground">
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={!!dcfg.tamper_external} onChange={(e) => setDoor({ tamper_external: e.target.checked })} disabled={readOnly} className="h-3 w-3" />
                    External Tamper
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={!!dcfg.dps} onChange={(e) => setDoor({ dps: e.target.checked })} disabled={readOnly} className="h-3 w-3" />
                    DPS (Door Position Sensor)
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={!!dcfg.ada} onChange={(e) => setDoor({ ada: e.target.checked })} disabled={readOnly} className="h-3 w-3" />
                    ADA Compliant
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={!!dcfg.fire_rated} onChange={(e) => setDoor({ fire_rated: e.target.checked })} disabled={readOnly} className="h-3 w-3" />
                    Fire Rated
                  </label>
                </div>

                {/* Controller ID / Port ID */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">Controller ID</label>
                    <input
                      defaultValue={(dcfg.controller_id as string) || ''}
                      onChange={(e) => debouncedUpdate('door_config', { ...dcfg, controller_id: e.target.value })}
                      disabled={readOnly}
                      placeholder="LP1502-01"
                      className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">Port</label>
                    <input
                      defaultValue={(dcfg.port_id as string) || ''}
                      onChange={(e) => debouncedUpdate('door_config', { ...dcfg, port_id: e.target.value })}
                      disabled={readOnly}
                      placeholder="P1"
                      className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Vape/Env Detection — Collapsible */}
        {device.system_type === 'vape_environmental' && (
          <div className="rounded border border-border">
            <button
              onClick={() => setShowVape(!showVape)}
              className="flex w-full items-center justify-between px-2 py-1.5 text-[10px] font-semibold text-foreground"
            >
              Detection Capabilities
              {showVape ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {showVape && (
              <div className="border-t border-border px-2 py-2 space-y-1">
                {VAPE_DETECTION_CAPABILITIES.map((cap) => (
                  <label key={cap.value} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={!!device.detection_capabilities?.[cap.value]}
                      onChange={(e) => {
                        const updated = { ...device.detection_capabilities, [cap.value]: e.target.checked }
                        onUpdate({ detection_capabilities: updated })
                      }}
                      disabled={readOnly}
                      className="h-3 w-3 rounded border-border"
                    />
                    <span className="text-[10px] text-foreground">{cap.label}</span>
                  </label>
                ))}
                <div className="mt-2">
                  <label className="block text-[10px] text-muted-foreground mb-0.5">Alert Destination</label>
                  <input
                    defaultValue={device.alert_destination || ''}
                    onChange={(e) => debouncedUpdate('alert_destination', e.target.value)}
                    disabled={readOnly}
                    placeholder="e.g. VMS, email, SMS"
                    className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-0.5">Integration</label>
                  <input
                    defaultValue={device.integration_method || ''}
                    onChange={(e) => debouncedUpdate('integration_method', e.target.value)}
                    disabled={readOnly}
                    placeholder="e.g. API, relay, SNMP"
                    className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
