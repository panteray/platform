/**
 * Panteray — Lens Calculator
 *
 * Given a camera-to-target distance, sensor width, horizontal resolution, and
 * a target DORI level (or explicit PPF), returns the required focal length.
 *
 * Also returns the nearest common focal length in a catalog of typical
 * integer lenses so the user can pick a real off-the-shelf option.
 *
 * Thin-lens math (same as fov-dori.ts):
 *   tan(hFov/2) = (sensor_w / 2) / focal_length
 *   tan(hFov/2) = (scene_width / 2) / distance
 *   → focal_length = sensor_w × (distance / scene_width)
 *
 * scene_width = resolution_w / target_ppf
 *
 * No DB, no API, no defaults. Pure function.
 */

import { DORI_THRESHOLDS } from './fov-dori'

const MM_PER_FT = 304.8

export interface LensCalcInput {
  /** Camera-to-target distance (ft) */
  distanceFt: number
  /** Camera sensor width (mm) */
  sensorWmm: number
  /** Camera horizontal resolution (pixels) */
  resolutionW: number
  /** Target DORI level — drives target PPF */
  doriLevel: 'detection' | 'observation' | 'recognition' | 'identification' | 'inspection'
  /** Optional explicit PPF override. When set, overrides doriLevel PPF. */
  overridePpf?: number
}

export interface LensCalcOutput {
  /** Target PPF used in calculation */
  targetPpf: number
  /** Horizontal scene width at target distance (ft) */
  sceneWidthFt: number
  /** Exact focal length required (mm) */
  requiredFocalMm: number
  /** Horizontal FOV at required focal length (degrees) */
  hFovDeg: number
  /** Nearest common focal length (mm) — see COMMON_FOCAL_LENGTHS */
  nearestCommonMm: number
  /** PPF achieved with nearest common focal length */
  nearestCommonPpf: number
  /** hFOV at nearest common focal length (degrees) */
  nearestCommonHFovDeg: number
  /** Whether the nearest common lens still meets the target PPF */
  nearestCommonMeetsTarget: boolean
  /** Validation warnings */
  warnings: string[]
}

/** Typical off-the-shelf fixed-focal and mid-point varifocal lengths (mm) */
export const COMMON_FOCAL_LENGTHS = [
  1.4, 1.8, 2.1, 2.8, 3.6, 4, 6, 8, 12, 16, 25, 35, 50, 75, 100, 150,
]

export function calculateLens(input: LensCalcInput): LensCalcOutput {
  const warnings: string[] = []
  const distance = Math.max(0.1, input.distanceFt)
  const sensorW = Math.max(0.1, input.sensorWmm)
  const resW = Math.max(1, input.resolutionW)

  const tierPpf = DORI_THRESHOLDS[input.doriLevel] ?? DORI_THRESHOLDS.recognition
  const targetPpf = input.overridePpf && input.overridePpf > 0 ? input.overridePpf : tierPpf

  // scene_width (ft) such that resolution_w / scene_width = target_ppf
  const sceneWidthFt = resW / targetPpf

  // focal_length (mm) = sensor_w (mm) × (distance / scene_width)
  const requiredFocalMm = sensorW * (distance / sceneWidthFt)

  const hFovDeg = focalToHFov(requiredFocalMm, sensorW)

  // Pick nearest common focal length that is >= required (longer focal = more zoom = ≥ target PPF)
  let nearestCommonMm = COMMON_FOCAL_LENGTHS[COMMON_FOCAL_LENGTHS.length - 1]
  for (const f of COMMON_FOCAL_LENGTHS) {
    if (f >= requiredFocalMm) {
      nearestCommonMm = f
      break
    }
  }

  const nearestHFov = focalToHFov(nearestCommonMm, sensorW)
  const nearestSceneWidth = 2 * distance * Math.tan((nearestHFov / 2) * (Math.PI / 180))
  const nearestCommonPpf = resW / Math.max(0.0001, nearestSceneWidth)
  const nearestCommonMeetsTarget = nearestCommonPpf >= targetPpf * 0.98 // 2% tolerance

  if (requiredFocalMm < 1) {
    warnings.push('Required focal length under 1mm — no standard lens covers this. Move camera closer or lower target PPF.')
  }
  if (requiredFocalMm > 150) {
    warnings.push('Required focal length over 150mm — consider a PTZ with optical zoom or reduce target distance.')
  }
  if (hFovDeg < 5) {
    warnings.push('Horizontal FOV under 5° — extremely narrow. Aiming tolerance becomes critical.')
  }
  if (hFovDeg > 120) {
    warnings.push('Horizontal FOV over 120° — lens distortion (fisheye) is significant at edges. Consider a panoramic camera.')
  }
  if (!nearestCommonMeetsTarget) {
    warnings.push(`Nearest off-the-shelf lens (${nearestCommonMm}mm) falls short of target PPF. Consider the next step up or varifocal.`)
  }

  return {
    targetPpf,
    sceneWidthFt,
    requiredFocalMm,
    hFovDeg,
    nearestCommonMm,
    nearestCommonPpf,
    nearestCommonHFovDeg: nearestHFov,
    nearestCommonMeetsTarget,
    warnings,
  }
}

function focalToHFov(focalMm: number, sensorWmm: number): number {
  return 2 * Math.atan(sensorWmm / (2 * Math.max(0.0001, focalMm))) * (180 / Math.PI)
}

export function validateLensInput(input: LensCalcInput): string[] {
  const errors: string[] = []
  if (!(input.distanceFt > 0)) errors.push('Distance must be greater than 0')
  if (!(input.sensorWmm > 0)) errors.push('Sensor width must be greater than 0')
  if (!(input.resolutionW > 0)) errors.push('Resolution width must be greater than 0')
  return errors
}
