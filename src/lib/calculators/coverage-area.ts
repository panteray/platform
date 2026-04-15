/**
 * Panteray — Coverage Area Calculator
 *
 * Given a rectangular area, camera optics, and a target DORI level, determines
 * how many cameras are needed and how to lay them out in a grid. Uses the same
 * FOV math as fov-dori.ts — thin-lens scene width at the distance where PPF
 * equals the target tier.
 *
 * No DB, no API, no defaults. Pure function.
 */

import { DORI_THRESHOLDS } from './fov-dori'

const MM_PER_FT = 304.8

export interface CoverageAreaInput {
  /** Room width in feet */
  roomWidthFt: number
  /** Room length in feet */
  roomLengthFt: number
  /** Camera sensor width (mm) */
  sensorWmm: number
  /** Camera focal length (mm) */
  focalLengthMm: number
  /** Camera horizontal resolution (pixels) */
  resolutionW: number
  /** Target DORI level: 'detection' | 'observation' | 'recognition' | 'identification' */
  doriLevel: 'detection' | 'observation' | 'recognition' | 'identification'
  /** Coverage overlap percent between adjacent cameras (0-50). Default 15%. */
  overlapPct: number
}

export interface CoverageAreaOutput {
  /** Target PPF from IEC 62676-4 */
  targetPpf: number
  /** Effective camera-to-target distance (ft) where PPF = target */
  effectiveDistanceFt: number
  /** Horizontal FOV (degrees) */
  hFovDeg: number
  /** Scene width at effective distance (ft) */
  sceneWidthFt: number
  /** Area per camera (ft²) — triangle approximation */
  areaPerCameraSqFt: number
  /** Effective horizontal spacing after overlap (ft) */
  spacingFt: number
  /** Total cameras required */
  cameraCount: number
  /** Grid rows (along length) */
  rows: number
  /** Grid cols (along width) */
  cols: number
  /** Validation warnings */
  warnings: string[]
}

const DORI_PPF: Record<CoverageAreaInput['doriLevel'], number> = {
  detection: DORI_THRESHOLDS.detection,
  observation: DORI_THRESHOLDS.observation,
  recognition: DORI_THRESHOLDS.recognition,
  identification: DORI_THRESHOLDS.identification,
}

export function calculateCoverageArea(input: CoverageAreaInput): CoverageAreaOutput {
  const warnings: string[] = []
  const { roomWidthFt, roomLengthFt, sensorWmm, focalLengthMm, resolutionW, doriLevel, overlapPct } = input

  if (roomWidthFt <= 0 || roomLengthFt <= 0) warnings.push('Room dimensions must be positive')
  if (sensorWmm <= 0 || focalLengthMm <= 0) warnings.push('Optics must be positive')
  if (resolutionW <= 0) warnings.push('Resolution must be positive')
  if (overlapPct < 0 || overlapPct >= 100) warnings.push('Overlap must be between 0 and 99%')

  const targetPpf = DORI_PPF[doriLevel]

  // Effective distance: solve calculatePpfAtDistance(..., dist) = targetPpf
  //   PPF = resW / sceneWidthFt
  //   sceneWidthFt = resW / targetPpf
  //   sceneWidthMm = sceneWidthFt * MM_PER_FT
  //   distMm = focal * sceneWidthMm / sensorW  (thin lens)
  const sceneWidthFt = resolutionW / targetPpf
  const sceneWidthMm = sceneWidthFt * MM_PER_FT
  const distMm = sensorWmm > 0 ? (focalLengthMm * sceneWidthMm) / sensorWmm : 0
  const effectiveDistanceFt = distMm / MM_PER_FT

  const hFovRad = 2 * Math.atan(sensorWmm / (2 * focalLengthMm))
  const hFovDeg = (hFovRad * 180) / Math.PI

  // Triangle area: (1/2) * base * height, where base = scene width at dist, height = dist
  const areaPerCameraSqFt = 0.5 * sceneWidthFt * effectiveDistanceFt

  const overlapFactor = Math.max(0, 1 - Math.min(99, overlapPct) / 100)
  const spacingFt = sceneWidthFt * overlapFactor
  const depthFt = effectiveDistanceFt * overlapFactor

  let cols = 0
  let rows = 0
  if (spacingFt > 0 && depthFt > 0) {
    cols = Math.max(1, Math.ceil(roomWidthFt / spacingFt))
    rows = Math.max(1, Math.ceil(roomLengthFt / depthFt))
  }
  const cameraCount = rows * cols

  if (effectiveDistanceFt > Math.max(roomWidthFt, roomLengthFt) * 2) {
    warnings.push(
      'Effective distance exceeds 2× room size — lens may be too long for target PPF in this space',
    )
  }
  if (cameraCount === 0) warnings.push('Unable to compute camera count with given inputs')

  return {
    targetPpf,
    effectiveDistanceFt: round(effectiveDistanceFt),
    hFovDeg: round(hFovDeg),
    sceneWidthFt: round(sceneWidthFt),
    areaPerCameraSqFt: round(areaPerCameraSqFt),
    spacingFt: round(spacingFt),
    cameraCount,
    rows,
    cols,
    warnings,
  }
}

export function validateCoverageAreaInput(
  input: Partial<CoverageAreaInput>,
): { valid: boolean; missingFields: string[] } {
  const missing: string[] = []
  if (!input.roomWidthFt) missing.push('roomWidthFt')
  if (!input.roomLengthFt) missing.push('roomLengthFt')
  if (!input.sensorWmm) missing.push('sensorWmm')
  if (!input.focalLengthMm) missing.push('focalLengthMm')
  if (!input.resolutionW) missing.push('resolutionW')
  if (!input.doriLevel) missing.push('doriLevel')
  return { valid: missing.length === 0, missingFields: missing }
}

function round(v: number, d: number = 1): number {
  const f = Math.pow(10, d)
  return Math.round(v * f) / f
}
