'use client'

import React from 'react'
import { C, PPF_CHART } from './constants'
import { classifyDori } from '@/lib/calculators'
import type { DoriClassification } from '@/lib/calculators'

interface PersonPreviewProps {
  ppf: number
  distanceFt: number
  cameraLabel?: string
  onClose?: () => void
}

/**
 * Person Silhouette Preview — shows what a camera "sees" at a given PPF.
 *
 * Renders a pixelated grid representing a 6ft person as seen by the camera,
 * with DORI classification and a quality indicator. This is the Panteray
 * equivalent of IPVM's "person at distance" preview.
 */
export function PersonPreview({ ppf, distanceFt, cameraLabel, onClose }: PersonPreviewProps) {
  const dori = classifyDori(ppf)
  const PERSON_HEIGHT_FT = 6
  const PERSON_WIDTH_FT = 2

  // How many pixels tall/wide is a person at this PPF
  const pixelsH = Math.round(ppf * PERSON_HEIGHT_FT)
  const pixelsW = Math.round(ppf * PERSON_WIDTH_FT)

  // Clamp display grid size (max 200px rendering)
  const maxDisplayH = 180
  const cellSize = pixelsH > 0 ? Math.min(Math.max(Math.floor(maxDisplayH / pixelsH), 1), 12) : 4
  const displayH = pixelsH * cellSize
  const displayW = pixelsW * cellSize

  const doriColors: Record<DoriClassification, string> = {
    inspection: C.purple,
    identification: C.green,
    recognition: C.yellow,
    observation: C.orange,
    detection: C.red,
    monitor: C.gray,
    none: '#78716c',
  }

  const doriLabels: Record<DoriClassification, string> = {
    inspection: 'Inspection — forensic-level detail',
    identification: 'Identification — face clearly visible',
    recognition: 'Recognition — known person recognizable',
    observation: 'Observation — activity visible',
    detection: 'Detection — presence detectable',
    monitor: 'Monitor — general scene awareness',
    none: 'Below Monitor — insufficient detail',
  }

  // Generate the silhouette pixel mask (simplified person shape)
  function getPersonMask(w: number, h: number): boolean[][] {
    const mask: boolean[][] = Array.from({ length: h }, () => Array(w).fill(false))
    if (w < 1 || h < 1) return mask

    const headTop = 0
    const headBot = Math.floor(h * 0.18)
    const neckBot = Math.floor(h * 0.22)
    const shoulderBot = Math.floor(h * 0.28)
    const torsoBot = Math.floor(h * 0.58)
    const legBot = h

    const cx = w / 2

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (x + 0.5 - cx) / (w / 2)

        if (y >= headTop && y < headBot) {
          // Head — circle
          const headR = 0.4
          const headCy = (headTop + headBot) / 2
          const dy = (y - headCy) / ((headBot - headTop) / 2)
          if (dx * dx + dy * dy <= 1.1) mask[y][x] = true
        } else if (y >= headBot && y < neckBot) {
          // Neck
          if (Math.abs(dx) < 0.25) mask[y][x] = true
        } else if (y >= neckBot && y < shoulderBot) {
          // Shoulders — widen
          const t = (y - neckBot) / (shoulderBot - neckBot)
          const width = 0.25 + t * 0.75
          if (Math.abs(dx) < width) mask[y][x] = true
        } else if (y >= shoulderBot && y < torsoBot) {
          // Torso
          if (Math.abs(dx) < 0.75) mask[y][x] = true
        } else if (y >= torsoBot && y < legBot) {
          // Legs — gap in center
          const legWidth = 0.35
          const gapWidth = 0.12
          if ((dx > gapWidth && dx < gapWidth + legWidth) || (dx < -gapWidth && dx > -gapWidth - legWidth)) {
            mask[y][x] = true
          }
        }
      }
    }
    return mask
  }

  const personMask = getPersonMask(pixelsW, pixelsH)

  // Find matching PPF chart entry
  const chartEntry = PPF_CHART.find(e => ppf >= e.min) ?? PPF_CHART[PPF_CHART.length - 1]

  return (
    <div style={{
      background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 10,
      padding: '16px 18px', minWidth: 220, maxWidth: 280,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.text }}>Person Preview</div>
          {cameraLabel && <div style={{ fontSize: 9, color: C.textDim }}>{cameraLabel}</div>}
        </div>
        {onClose && (
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer',
            fontSize: 14, padding: 2, lineHeight: 1,
          }}>×</button>
        )}
      </div>

      {/* PPF + DORI Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{
          background: `${doriColors[dori]}18`, border: `1px solid ${doriColors[dori]}40`,
          borderRadius: 6, padding: '4px 10px', fontSize: 18, fontWeight: 800,
          color: doriColors[dori], fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace",
        }}>
          {Math.round(ppf)} PPF
        </div>
        <div style={{ fontSize: 10, color: C.textMuted, lineHeight: 1.3 }}>
          <div style={{ color: doriColors[dori], fontWeight: 600 }}>{chartEntry.label}</div>
          <div>{distanceFt.toFixed(0)} ft away</div>
        </div>
      </div>

      {/* Person Silhouette Grid */}
      <div style={{
        background: '#0a0b0f', borderRadius: 6, padding: 8,
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        minHeight: 80, marginBottom: 10,
        border: `1px solid ${C.borderSubtle}`,
      }}>
        {pixelsH > 0 && pixelsW > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${pixelsW}, ${cellSize}px)`,
            gridTemplateRows: `repeat(${pixelsH}, ${cellSize}px)`,
            gap: cellSize > 3 ? 0.5 : 0,
          }}>
            {personMask.flat().map((filled, i) => (
              <div key={i} style={{
                width: cellSize, height: cellSize,
                background: filled ? doriColors[dori] : 'rgba(255,255,255,0.03)',
                borderRadius: cellSize > 4 ? 1 : 0,
                opacity: filled ? (0.5 + Math.random() * 0.3) : 1,
              }} />
            ))}
          </div>
        ) : (
          <div style={{ color: C.textDim, fontSize: 10, textAlign: 'center', padding: 16 }}>
            Too few pixels to render<br />({Math.round(ppf)} PPF × 6ft = {pixelsH}px)
          </div>
        )}
      </div>

      {/* DORI Description */}
      <div style={{
        fontSize: 10, color: C.textMuted, lineHeight: 1.4,
        padding: '6px 0', borderTop: `1px solid ${C.borderSubtle}`,
      }}>
        {doriLabels[dori]}
      </div>

      {/* Pixel count info */}
      <div style={{ fontSize: 9, color: C.textDim, fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace" }}>
        {pixelsH}×{pixelsW}px person • {(ppf * ppf).toLocaleString()} px/ft²
      </div>
    </div>
  )
}
