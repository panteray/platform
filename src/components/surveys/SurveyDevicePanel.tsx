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

  // Photo capture
  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoCapturing(true)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string
      await fetch(`/api/org/surveys/${surveyId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: device.id,
          base64,
          caption: `${device.label} — ${deviceTypeLabel}`,
        }),
      })
      setPhotoCapturing(false)
    }
    reader.readAsDataURL(file)
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
                    value={(device.door_config as Record<string, string>)?.door_type || ''}
                    onChange={(e) => onUpdate({ door_config: { ...device.door_config, door_type: e.target.value } })}
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
                    value={(device.door_config as Record<string, string>)?.lock_type || ''}
                    onChange={(e) => onUpdate({ door_config: { ...device.door_config, lock_type: e.target.value } })}
                    disabled={readOnly}
                    className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] outline-none"
                  >
                    <option value="">—</option>
                    {LOCK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                {['has_rex', 'has_dps', 'ada_compliant', 'auto_operator'].map((key) => (
                  <label key={key} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={!!(device.door_config as Record<string, boolean>)?.[key]}
                      onChange={(e) => onUpdate({ door_config: { ...device.door_config, [key]: e.target.checked } })}
                      disabled={readOnly}
                      className="h-3 w-3 rounded border-border"
                    />
                    <span className="text-[10px] text-foreground">
                      {key === 'has_rex' ? 'REX' : key === 'has_dps' ? 'Door Contact (DPS)' : key === 'ada_compliant' ? 'ADA Compliant' : 'Auto Operator'}
                    </span>
                  </label>
                ))}
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
