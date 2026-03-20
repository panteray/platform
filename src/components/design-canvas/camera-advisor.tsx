'use client'

import React, { useState, useMemo } from 'react'
import { C } from './constants'
import { COMMON_SENSORS, calculatePpfAtDistance, classifyDori } from '@/lib/calculators'
import type { DoriClassification } from '@/lib/calculators'

interface CameraAdvisorProps {
  onClose?: () => void
}

interface CameraResult {
  sensorLabel: string
  resolutionW: number
  resolutionH: number
  sensorW: number
  sensorH: number
  requiredFocalLengthMm: number
  hFovDeg: number
  achievedPpf: number
  dori: DoriClassification
}

const MM_PER_FT = 304.8

const COMMON_RESOLUTIONS = [
  { label: '2MP (1920×1080)', w: 1920, h: 1080 },
  { label: '4MP (2560×1440)', w: 2560, h: 1440 },
  { label: '5MP (2592×1944)', w: 2592, h: 1944 },
  { label: '4K/8MP (3840×2160)', w: 3840, h: 2160 },
  { label: '6MP (3072×2048)', w: 3072, h: 2048 },
  { label: '12MP (4000×3000)', w: 4000, h: 3000 },
  { label: '16MP (4656×3496)', w: 4656, h: 3496 },
]

const DORI_LABELS: Record<DoriClassification, string> = {
  identification: 'Identification',
  recognition: 'Recognition',
  observation: 'Observation',
  detection: 'Detection',
  none: 'Monitor Only',
}

const DORI_COLORS: Record<DoriClassification, string> = {
  identification: C.green,
  recognition: C.yellow,
  observation: C.orange,
  detection: C.red,
  none: '#78716c',
}

/**
 * Camera Advisor — Reverse PPF/DORI Calculator
 *
 * Input: desired PPF + target distance
 * Output: table of required focal lengths for each sensor/resolution combo,
 * showing which achieve the target DORI classification.
 */
export function CameraAdvisor({ onClose }: CameraAdvisorProps) {
  const [targetPpf, setTargetPpf] = useState(76)
  const [targetDistFt, setTargetDistFt] = useState(30)
  const [selectedRes, setSelectedRes] = useState(0) // index into COMMON_RESOLUTIONS

  const results: CameraResult[] = useMemo(() => {
    const res = COMMON_RESOLUTIONS[selectedRes]
    if (!res) return []

    return COMMON_SENSORS.map((sensor) => {
      // Required scene width (ft) to achieve target PPF
      const requiredSceneWidthFt = res.w / targetPpf
      // Required scene width (mm)
      const requiredSceneWidthMm = requiredSceneWidthFt * MM_PER_FT
      // Required focal length: f = (sensorW × distance) / sceneWidth
      const targetDistMm = targetDistFt * MM_PER_FT
      const requiredFocalLengthMm = (sensor.w * targetDistMm) / requiredSceneWidthMm

      // Calculate actual hFov with this focal length
      const hFovRad = 2 * Math.atan(sensor.w / (2 * requiredFocalLengthMm))
      const hFovDeg = hFovRad * (180 / Math.PI)

      // Calculate achieved PPF at target distance with this focal length
      const achievedPpf = calculatePpfAtDistance(res.w, sensor.w, requiredFocalLengthMm, targetDistFt)
      const dori = classifyDori(achievedPpf)

      return {
        sensorLabel: sensor.label,
        resolutionW: res.w,
        resolutionH: res.h,
        sensorW: sensor.w,
        sensorH: sensor.h,
        requiredFocalLengthMm: Math.round(requiredFocalLengthMm * 10) / 10,
        hFovDeg: Math.round(hFovDeg * 10) / 10,
        achievedPpf: Math.round(achievedPpf),
        dori,
      }
    })
  }, [targetPpf, targetDistFt, selectedRes])

  const selectStyle = {
    background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4,
    padding: '4px 8px', fontSize: 11, color: C.text, outline: 'none',
    fontFamily: "'IBM Plex Mono', monospace", cursor: 'pointer', width: '100%',
  }

  const inputStyle = {
    ...selectStyle, width: 80, textAlign: 'right' as const,
  }

  return (
    <div style={{
      width: 320, background: C.bgPanel, borderLeft: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column' as const, height: '100%', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', borderBottom: `1px solid ${C.border}`, background: C.bgSurface,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Camera Advisor</div>
          <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>Reverse PPF/DORI lookup</div>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', padding: 4, fontSize: 14 }}>×</button>
        )}
      </div>

      {/* Inputs */}
      <div style={{ padding: 16, borderBottom: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Target PPF */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: C.textMuted }}>Target PPF</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {[8, 19, 38, 76].map((ppf) => (
              <button key={ppf} onClick={() => setTargetPpf(ppf)} style={{
                padding: '3px 8px', fontSize: 10, fontWeight: 600,
                borderRadius: 4, cursor: 'pointer', border: 'none',
                background: targetPpf === ppf ? `${DORI_COLORS[classifyDori(ppf)]}20` : C.bg,
                color: targetPpf === ppf ? DORI_COLORS[classifyDori(ppf)] : C.textMuted,
                outline: targetPpf === ppf ? `1px solid ${DORI_COLORS[classifyDori(ppf)]}` : `1px solid ${C.border}`,
              }}>
                {ppf}
              </button>
            ))}
            <input type="number" min="1" max="500" value={targetPpf}
              onChange={(e) => setTargetPpf(Number(e.target.value) || 76)}
              style={inputStyle} />
          </div>
        </div>

        {/* Target Distance */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: C.textMuted }}>Distance (ft)</span>
          <input type="number" min="1" max="500" value={targetDistFt}
            onChange={(e) => setTargetDistFt(Number(e.target.value) || 30)}
            style={inputStyle} />
        </div>

        {/* Resolution */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: C.textMuted }}>Resolution</span>
          <select value={selectedRes} onChange={(e) => setSelectedRes(Number(e.target.value))} style={{ ...selectStyle, width: 160 }}>
            {COMMON_RESOLUTIONS.map((r, i) => (
              <option key={i} value={i}>{r.label}</option>
            ))}
          </select>
        </div>

        {/* DORI target indicator */}
        <div style={{
          padding: '6px 10px', borderRadius: 4,
          background: `${DORI_COLORS[classifyDori(targetPpf)]}12`,
          border: `1px solid ${DORI_COLORS[classifyDori(targetPpf)]}30`,
          fontSize: 10, color: DORI_COLORS[classifyDori(targetPpf)], fontWeight: 600,
        }}>
          Target: {targetPpf} PPF = {DORI_LABELS[classifyDori(targetPpf)]} at {targetDistFt} ft
        </div>
      </div>

      {/* Results Table */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: C.textDim, letterSpacing: 0.5, marginBottom: 8 }}>
          Required Focal Length by Sensor Size
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {results.map((r) => {
            const feasible = r.requiredFocalLengthMm >= 2 && r.requiredFocalLengthMm <= 50
            return (
              <div key={r.sensorLabel} style={{
                padding: '8px 10px', background: C.bgSurface, border: `1px solid ${C.border}`,
                borderRadius: 6, opacity: feasible ? 1 : 0.5,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.text }}>{r.sensorLabel} sensor</div>
                    <div style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>
                      {r.sensorW}×{r.sensorH}mm
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontSize: 16, fontWeight: 800, color: feasible ? C.accent : C.textDim,
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}>
                      {r.requiredFocalLengthMm}mm
                    </div>
                    <div style={{ fontSize: 9, color: C.textDim }}>
                      {r.hFovDeg}° FOV
                    </div>
                  </div>
                </div>
                {/* Feasibility badge */}
                <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                  <span style={{
                    fontSize: 9, padding: '1px 6px', borderRadius: 3,
                    background: feasible ? `${C.green}18` : `${C.red}18`,
                    color: feasible ? C.green : C.red, fontWeight: 600,
                  }}>
                    {feasible ? '✓ Standard lens' : '✗ Specialty lens'}
                  </span>
                  <span style={{
                    fontSize: 9, padding: '1px 6px', borderRadius: 3,
                    background: `${DORI_COLORS[r.dori]}18`,
                    color: DORI_COLORS[r.dori], fontWeight: 600,
                  }}>
                    {r.achievedPpf} PPF
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Info note */}
        <div style={{ marginTop: 12, fontSize: 9, color: C.textDim, lineHeight: 1.5 }}>
          Standard lenses: 2.8mm–50mm. Results show the focal length needed to achieve {targetPpf} PPF 
          ({DORI_LABELS[classifyDori(targetPpf)]}) at {targetDistFt} ft for each sensor size.
        </div>
      </div>
    </div>
  )
}
