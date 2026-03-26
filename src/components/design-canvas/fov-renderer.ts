/**
 * FOV Renderer — Clean FOV cone rendering for Fabric.js canvas.
 *
 * KEY DESIGN DECISIONS (lessons from IPVM/Hanwha/Axis patterns):
 *
 * 1. Points are LOCAL coordinates (0,0 = camera position / cone apex)
 *    - Polygon is positioned on canvas via left/top
 *    - No _calcDimensions() hacks needed
 *    - scaleX/scaleY/rotation work correctly from the apex
 *
 * 2. All cone tiers for a device are in a Fabric Group
 *    - Moving the group moves all tiers together
 *    - No __origLeft/__origTop delta tracking needed
 *    - Rotation is a single angle property on the group
 *
 * 3. Single shared buildConePoints() function
 *    - Used by initial render AND drag handlers
 *    - No duplicated point-construction code
 *
 * 4. Wall clipping uses Sutherland-Hodgman (polygon-clip.ts)
 *    - Proper polygon boolean operation
 *    - Not per-point ray-casting
 */

import type { DeviceFovData } from './canvas-area'
import type { DesignDevice } from '@/types/database'

// ---- Types ----

export interface ConePoint {
  x: number
  y: number
}

export interface FovTierPolygon {
  points: ConePoint[]
  color: string
  opacity: number
  tierIndex: number
  zoneName: string | null
  radius: number // px
}

// ---- Zone mapping ----

const COLOR_TO_ZONE: Record<string, string> = {
  '#8b5cf6': 'inspection',
  '#22c55e': 'identification',
  '#eab308': 'recognition',
  '#f97316': 'observation',
  '#ef4444': 'detection',
  '#6b7280': 'monitor',
}

// ---- Core geometry ----

/**
 * Build cone polygon points in LOCAL coordinates (0,0 = camera apex).
 *
 * This is THE canonical point-generation function. Used by:
 * - Initial FOV rendering
 * - Distance handle drag
 * - Angle handle drag
 * - Rotation ring drag
 *
 * All callers get identical geometry. No duplicated loops.
 */
export function buildConePoints(
  halfAngRad: number,
  rotationRad: number,
  radiusPx: number,
  steps: number = 24,
): ConePoint[] {
  const pts: ConePoint[] = [{ x: 0, y: 0 }] // apex at local origin
  for (let i = 0; i <= steps; i++) {
    const a = rotationRad - halfAngRad + (2 * halfAngRad * i / steps)
    pts.push({
      x: Math.cos(a) * radiusPx,
      y: Math.sin(a) * radiusPx,
    })
  }
  return pts
}

/**
 * Build all tier polygons for a device's FOV cone.
 * Returns local-coordinate polygons ready for Fabric.js.
 */
export function buildFovTiers(
  data: DeviceFovData,
  scalePxPerFt: number,
  sensorRotationRad: number,
  fovDisplayMode: 'simple' | 'ppf' | 'dori' | 'heatmap' = 'simple',
  hiddenPpfZones?: Set<string>,
): FovTierPolygon[] {
  const halfAng = (data.hFov / 2) * Math.PI / 180
  const tiers: FovTierPolygon[] = []

  for (let t = 0; t < data.tiers.length; t++) {
    const tier = data.tiers[t]
    const r = tier.distanceFt * (scalePxPerFt || 10)
    if (r < 2) continue

    const zoneName = COLOR_TO_ZONE[tier.color] || null
    if (zoneName && hiddenPpfZones?.has(zoneName)) continue

    let fillColor = data.colorHex || '#3b82f6'
    if (fovDisplayMode === 'ppf' || fovDisplayMode === 'dori') {
      fillColor = tier.color
    }

    // Graduated opacity: inner tiers denser (IPVM pattern)
    const gradOpacity = tier.opacity * (1 + (data.tiers.length - 1 - t) * 0.15)

    const points = buildConePoints(halfAng, sensorRotationRad, r)

    tiers.push({
      points,
      color: fillColor,
      opacity: Math.min(0.7, gradOpacity),
      tierIndex: t,
      zoneName,
      radius: r,
    })
  }

  return tiers
}

/**
 * Compute sensor rotation angles for multi-sensor cameras.
 */
export function getSensorRotations(
  device: DesignDevice,
  data: DeviceFovData,
): number[] {
  if (data.sensorAngles && data.sensorAngles.length > 1) {
    return data.sensorAngles
  }
  return [device.rotation || 0]
}

/**
 * Rebuild cone points during distance handle drag.
 * Returns new points for each tier, scaled by the drag ratio.
 */
export function rebuildConeForDistanceDrag(
  data: DeviceFovData,
  newRotationRad: number,
  distScaleFactor: number,
  scalePxPerFt: number,
): ConePoint[][] {
  const halfAng = (data.hFov / 2) * Math.PI / 180
  const results: ConePoint[][] = []

  for (const tier of data.tiers) {
    const r = tier.distanceFt * (scalePxPerFt || 10) * distScaleFactor
    if (r < 2) {
      results.push([])
      continue
    }
    results.push(buildConePoints(halfAng, newRotationRad, r))
  }

  return results
}

/**
 * Rebuild cone points during angle handle drag.
 * Returns new points for each tier with the new FOV angle.
 */
export function rebuildConeForAngleDrag(
  data: DeviceFovData,
  newHFovDeg: number,
  rotationRad: number,
  scalePxPerFt: number,
): ConePoint[][] {
  const halfAng = (newHFovDeg / 2) * Math.PI / 180
  const results: ConePoint[][] = []

  for (const tier of data.tiers) {
    const r = tier.distanceFt * (scalePxPerFt || 10)
    if (r < 2) {
      results.push([])
      continue
    }
    results.push(buildConePoints(halfAng, rotationRad, r))
  }

  return results
}

/**
 * Get the handle positions for the selected device's FOV.
 * Returns positions in LOCAL coordinates (relative to camera).
 */
export function getHandlePositions(
  data: DeviceFovData,
  scalePxPerFt: number,
  rotationRad: number,
): {
  distance: ConePoint       // Center of arc (for distance handle)
  angleLeft: ConePoint      // Left edge of arc (for angle handle)
  angleRight: ConePoint     // Right edge of arc (for angle handle)
  outerRadius: number       // Radius in px
} {
  const outerR = (data.tiers[0]?.distanceFt || 30) * (scalePxPerFt || 10)
  const halfAng = (data.hFov / 2) * Math.PI / 180

  return {
    distance: {
      x: Math.cos(rotationRad) * outerR,
      y: Math.sin(rotationRad) * outerR,
    },
    angleLeft: {
      x: Math.cos(rotationRad - halfAng) * outerR,
      y: Math.sin(rotationRad - halfAng) * outerR,
    },
    angleRight: {
      x: Math.cos(rotationRad + halfAng) * outerR,
      y: Math.sin(rotationRad + halfAng) * outerR,
    },
    outerRadius: outerR,
  }
}

/**
 * Build a centerline (IR range line) in local coordinates.
 */
export function buildCenterline(
  rotationRad: number,
  radiusPx: number,
): { x1: number; y1: number; x2: number; y2: number } {
  return {
    x1: 0,
    y1: 0,
    x2: Math.cos(rotationRad) * radiusPx,
    y2: Math.sin(rotationRad) * radiusPx,
  }
}

/**
 * Build a circle polygon in local coordinates (for PTZ pan range or blind spot).
 */
export function buildCirclePoints(
  radiusPx: number,
  steps: number = 36,
): ConePoint[] {
  const pts: ConePoint[] = []
  for (let i = 0; i <= steps; i++) {
    const a = (2 * Math.PI * i) / steps
    pts.push({
      x: Math.cos(a) * radiusPx,
      y: Math.sin(a) * radiusPx,
    })
  }
  return pts
}

// ---- DORI zone label data ----

export function getZoneLabel(zoneName: string): string {
  switch (zoneName) {
    case 'inspection': return 'INS'
    case 'identification': return 'ID'
    case 'recognition': return 'REC'
    case 'observation': return 'OBS'
    case 'detection': return 'DET'
    case 'monitor': return 'MON'
    default: return ''
  }
}

/**
 * Z-index layer constants.
 * Used by a single z-ordering function instead of distributed bringToFront/sendToBack calls.
 */
export const Z_LAYERS = {
  GRID: 0,
  FLOOR_PLAN: 1,
  SATELLITE: 2,
  WALLS: 10,
  FOV_CONES: 20,
  CABLES: 30,
  MDF_CABLES: 31,
  MDF_ICONS: 40,
  DEVICES: 50,
  FOV_HANDLES: 60,
  SCALE_MARKERS: 70,
} as const
