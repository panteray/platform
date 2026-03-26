'use client'
/**
 * SimulatedView — Floating overlay showing a stock scene image cropped
 * to match the camera's horizontal angle of view (HAoV).
 *
 * 4 built-in CSS-gradient placeholder scenes (parking, hallway, entrance, street).
 * Each represents a nominal 120-degree field of view. The inner element is
 * scaled so narrow (telephoto) lenses zoom in more.
 */

import React, { useState, useMemo } from 'react'
import { X } from 'lucide-react'
import { C } from './constants'
import { classifyDori } from '@/lib/calculators'
import type { DoriClassification } from '@/lib/calculators'

/* ─── Props ─── */
export interface SimulatedViewProps {
  resolutionW: number
  sensorW: number
  focalLength: number
  targetDistFt: number
  installHeight: number
  ppf: number
  dori: DoriClassification
  onClose: () => void
}

/* ─── Scene definitions ─── */
type SceneKey = 'parking' | 'hallway' | 'entrance' | 'street'

interface SceneDef {
  label: string
  gradient: string
}

const SCENES: Record<SceneKey, SceneDef> = {
  parking: {
    label: 'Parking Lot',
    gradient: 'linear-gradient(180deg, #1a1a2e 0%, #2d2d44 40%, #3a3a50 60%, #4a4a5a 100%)',
  },
  hallway: {
    label: 'Hallway',
    gradient: 'linear-gradient(180deg, #3e3529 0%, #4a4035 40%, #564b40 60%, #625648 100%)',
  },
  entrance: {
    label: 'Building Entrance',
    gradient: 'linear-gradient(180deg, #2a3040 0%, #354050 40%, #3f4a5a 60%, #4a5565 100%)',
  },
  street: {
    label: 'Street View',
    gradient: 'linear-gradient(180deg, #4a4a4a 0%, #5a5a5a 40%, #6a6a6a 60%, #7a7a7a 100%)',
  },
}

const SCENE_KEYS: SceneKey[] = ['parking', 'hallway', 'entrance', 'street']
const NOMINAL_FOV = 120 // Each scene represents a 120-degree field of view

/* ─── DORI color map ─── */
const DORI_COLORS: Record<DoriClassification, string> = {
  inspection: '#8b5cf6',
  identification: '#22c55e',
  recognition: '#eab308',
  observation: '#f97316',
  detection: '#ef4444',
  monitor: '#6b7280',
  none: '#374151',
}

const DORI_LABELS: Record<DoriClassification, string> = {
  inspection: 'Inspection',
  identification: 'Identification',
  recognition: 'Recognition',
  observation: 'Observation',
  detection: 'Detection',
  monitor: 'Monitor',
  none: 'Below Monitor',
}

/* ─── Container dimensions ─── */
const CARD_W = 500
const CARD_H = 350
const VIEW_H = 260

/* ─── Component ─── */
export function SimulatedView({
  resolutionW, sensorW, focalLength, targetDistFt,
  installHeight, ppf, dori, onClose,
}: SimulatedViewProps) {
  const [scene, setScene] = useState<SceneKey>('street')

  const hFov = useMemo(() => {
    if (sensorW <= 0 || focalLength <= 0) return 0
    return 2 * Math.atan(sensorW / (2 * focalLength)) * (180 / Math.PI)
  }, [sensorW, focalLength])

  const scaleFactor = hFov > 0 ? NOMINAL_FOV / hFov : 1
  const innerWidth = CARD_W * scaleFactor

  const doriColor = DORI_COLORS[dori] ?? DORI_COLORS.none
  const doriLabel = DORI_LABELS[dori] ?? 'N/A'

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: CARD_W, background: '#1a1a2e',
        borderRadius: 10, border: `1px solid ${C.border}`,
        overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
      }}>
        {/* ── Header bar ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', borderBottom: `1px solid ${C.borderSubtle}`,
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
            Simulated View
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select
              value={scene}
              onChange={(e) => setScene(e.target.value as SceneKey)}
              style={{
                fontSize: 10, padding: '3px 6px', borderRadius: 4,
                background: C.bgActive, color: C.text, border: `1px solid ${C.border}`,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {SCENE_KEYS.map(k => (
                <option key={k} value={k}>{SCENES[k].label}</option>
              ))}
            </select>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: C.textMuted, padding: 2, display: 'flex',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Scene viewport ── */}
        <div style={{
          width: CARD_W, height: VIEW_H, overflow: 'hidden',
          position: 'relative', background: '#111',
        }}>
          {/* Inner element: wider than container, centered, to simulate crop */}
          <div style={{
            width: innerWidth, height: VIEW_H,
            background: SCENES[scene].gradient,
            position: 'absolute',
            left: (CARD_W - innerWidth) / 2,
            top: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.15)',
              letterSpacing: 2, textTransform: 'uppercase', userSelect: 'none',
            }}>
              {SCENES[scene].label}
            </span>
          </div>

          {/* ── PPF + DORI badge (bottom-left) ── */}
          <div style={{
            position: 'absolute', bottom: 8, left: 8,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{
              fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
              color: '#fff', background: 'rgba(0,0,0,0.6)',
              padding: '3px 7px', borderRadius: 4,
            }}>
              {Math.round(ppf)} PPF
            </span>
            <span style={{
              fontSize: 10, fontWeight: 600, fontFamily: 'monospace',
              color: '#fff', background: doriColor,
              padding: '3px 7px', borderRadius: 4,
            }}>
              {doriLabel}
            </span>
          </div>

          {/* ── AoV label (bottom-right) ── */}
          <div style={{
            position: 'absolute', bottom: 8, right: 8,
          }}>
            <span style={{
              fontSize: 11, fontWeight: 600, fontFamily: 'monospace',
              color: '#fff', background: 'rgba(0,0,0,0.6)',
              padding: '3px 7px', borderRadius: 4,
            }}>
              AoV: {hFov > 0 ? `${hFov.toFixed(1)}` : '--'}°
            </span>
          </div>
        </div>

        {/* ── Footer info ── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '6px 12px', borderTop: `1px solid ${C.borderSubtle}`,
        }}>
          <span style={{ fontSize: 9, color: C.textDim, fontFamily: 'monospace' }}>
            {resolutionW}px &middot; {focalLength}mm &middot; {targetDistFt}ft &middot; {installHeight}ft mount
          </span>
          <span style={{ fontSize: 9, color: C.textDim }}>
            Scene: {NOMINAL_FOV}° nominal
          </span>
        </div>
      </div>
    </div>
  )
}
