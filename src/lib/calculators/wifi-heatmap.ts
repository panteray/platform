/**
 * Panteray — WiFi Heatmap Calculator Engine
 *
 * Free-Space Path Loss (FSPL) model with wall/material attenuation.
 * Produces a grid of signal strength values for heatmap visualization.
 *
 * References:
 * - FSPL formula: FSPL(dB) = 20·log10(d) + 20·log10(f) - 27.55   (d in meters, f in MHz)
 * - ITU-R P.1238 indoor propagation model
 * - Wall attenuation values from Ekahau / iBwave industry standards
 */

// ---- Input Types ----

export interface WifiApInput {
  id: string
  label: string
  position_x: number
  position_y: number
  band: '2.4' | '5' | '6' | 'dual' | 'tri'
  channel: number | null
  channel_width: number       // MHz: 20, 40, 80, 160
  tx_power_dbm: number        // transmit power in dBm
  antenna_gain_dbi: number    // antenna gain in dBi
  mount_height_ft: number
  environment: Environment
  ap_model?: string
  vendor?: string
}

export type Environment = 'office' | 'warehouse' | 'outdoor' | 'classroom' | 'hospital'

export interface WallInput {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  material: WallMaterial
  thickness?: number  // inches
}

export type WallMaterial =
  | 'drywall'
  | 'glass'
  | 'concrete'
  | 'brick'
  | 'metal'
  | 'wood'
  | 'cubicle'

export interface HeatmapConfig {
  /** Pixels per grid cell — lower = higher resolution, more compute */
  gridResolution: number
  /** Canvas width in pixels */
  canvasWidth: number
  /** Canvas height in pixels */
  canvasHeight: number
  /** Scale: pixels per foot */
  scalePxPerFt: number
  /** Which band to calculate (for dual/tri APs) */
  targetBand: '2.4' | '5' | '6'
}

export interface HeatmapInput {
  aps: WifiApInput[]
  walls: WallInput[]
  config: HeatmapConfig
}

// ---- Output Types ----

export interface HeatmapCell {
  x: number
  y: number
  rssi: number           // dBm — strongest AP at this cell
  bestApId: string       // AP providing strongest signal
  snr: number            // signal-to-noise ratio in dB
}

export interface HeatmapOutput {
  grid: HeatmapCell[][]
  summary: HeatmapSummary
  perAp: ApCoverageResult[]
  timestamp: string
}

export interface HeatmapSummary {
  totalCells: number
  excellentCells: number   // >= -30 dBm
  goodCells: number        // -30 to -67 dBm
  fairCells: number        // -67 to -70 dBm
  poorCells: number        // -70 to -80 dBm
  deadCells: number        // < -80 dBm
  coveragePct: number      // % cells >= -70 dBm
  minRssi: number
  maxRssi: number
  avgRssi: number
}

export interface ApCoverageResult {
  apId: string
  label: string
  primaryCells: number      // cells where this AP is strongest
  maxRange_ft: number       // max distance with usable signal
  channelConflicts: string[] // IDs of APs on same/adjacent channel
}

// ---- Constants ----

/** Wall attenuation in dB by material (2.4 GHz / 5 GHz / 6 GHz) */
const WALL_ATTENUATION: Record<WallMaterial, { '2.4': number; '5': number; '6': number }> = {
  drywall:  { '2.4': 3,  '5': 4,  '6': 5  },
  glass:    { '2.4': 2,  '5': 3,  '6': 4  },
  concrete: { '2.4': 10, '5': 15, '6': 18 },
  brick:    { '2.4': 8,  '5': 12, '6': 15 },
  metal:    { '2.4': 12, '5': 18, '6': 22 },
  wood:     { '2.4': 4,  '5': 6,  '6': 7  },
  cubicle:  { '2.4': 1,  '5': 2,  '6': 2  },
}

/** Noise floor by environment in dBm */
const NOISE_FLOOR: Record<Environment, number> = {
  office:     -90,
  warehouse:  -95,
  outdoor:    -100,
  classroom:  -88,
  hospital:   -85,
}

/** Center frequency for each band in MHz */
const BAND_FREQ_MHZ: Record<string, number> = {
  '2.4': 2437,   // Channel 6
  '5':   5500,   // Channel 100
  '6':   6175,   // Channel 69
}

/** RSSI thresholds for coverage quality */
export const RSSI_THRESHOLDS = {
  excellent: -30,
  good:      -67,
  fair:      -70,
  poor:      -80,
} as const

/** Heatmap color stops (RSSI → hex) */
export const HEATMAP_COLORS: { rssi: number; color: string }[] = [
  { rssi: -30, color: '#22c55e' },  // green — excellent
  { rssi: -50, color: '#84cc16' },  // lime
  { rssi: -60, color: '#eab308' },  // yellow
  { rssi: -67, color: '#f97316' },  // orange — good threshold
  { rssi: -70, color: '#ef4444' },  // red — fair threshold
  { rssi: -80, color: '#7f1d1d' },  // dark red — poor
  { rssi: -100, color: '#1c1917' }, // near-black — dead
]

// ---- Core Functions ----

/**
 * Free-Space Path Loss in dB
 * FSPL(dB) = 20·log10(d_m) + 20·log10(f_MHz) - 27.55
 */
function fspl(distanceMeters: number, freqMhz: number): number {
  if (distanceMeters <= 0) return 0
  return 20 * Math.log10(distanceMeters) + 20 * Math.log10(freqMhz) - 27.55
}

/**
 * Count wall intersections between two points using line-segment intersection.
 * Returns array of wall materials crossed.
 */
function wallsBetween(
  x1: number, y1: number,
  x2: number, y2: number,
  walls: WallInput[]
): WallMaterial[] {
  const crossed: WallMaterial[] = []

  for (const wall of walls) {
    if (segmentsIntersect(x1, y1, x2, y2, wall.x1, wall.y1, wall.x2, wall.y2)) {
      crossed.push(wall.material)
    }
  }

  return crossed
}

/**
 * Line segment intersection test (2D).
 * Returns true if segment (p1→p2) crosses segment (p3→p4).
 */
function segmentsIntersect(
  x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number
): boolean {
  const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3)
  if (Math.abs(d) < 1e-10) return false // parallel

  const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d
  const u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d

  return t >= 0 && t <= 1 && u >= 0 && u <= 1
}

/**
 * Calculate RSSI at a point from a single AP, accounting for FSPL + wall attenuation.
 */
function calcRssiAtPoint(
  ap: WifiApInput,
  px: number,
  py: number,
  walls: WallInput[],
  band: '2.4' | '5' | '6',
  scalePxPerFt: number
): number {
  const dx = px - ap.position_x
  const dy = py - ap.position_y
  const distPx = Math.sqrt(dx * dx + dy * dy)
  const distFt = distPx / scalePxPerFt

  // Add height difference for 3D distance
  const heightDiffFt = ap.mount_height_ft - 4 // assume receiver at 4ft (desk height)
  const dist3dFt = Math.sqrt(distFt * distFt + heightDiffFt * heightDiffFt)
  const distMeters = dist3dFt * 0.3048

  if (distMeters < 0.1) return ap.tx_power_dbm + ap.antenna_gain_dbi // at the AP

  const freqMhz = BAND_FREQ_MHZ[band] ?? 5500
  const pathLoss = fspl(distMeters, freqMhz)

  // Wall attenuation
  const crossedWalls = wallsBetween(ap.position_x, ap.position_y, px, py, walls)
  let wallLoss = 0
  for (const mat of crossedWalls) {
    wallLoss += WALL_ATTENUATION[mat]?.[band] ?? 4
  }

  // EIRP - path loss - wall loss
  const eirp = ap.tx_power_dbm + ap.antenna_gain_dbi
  return eirp - pathLoss - wallLoss
}

/**
 * Determine which band to use for a given AP based on target.
 * Dual/tri APs use the target band. Single-band APs use their own band.
 */
function resolveApBand(ap: WifiApInput, targetBand: '2.4' | '5' | '6'): '2.4' | '5' | '6' {
  if (ap.band === 'dual' || ap.band === 'tri') return targetBand
  return ap.band
}

/**
 * Check for co-channel or adjacent-channel interference between APs.
 */
function findChannelConflicts(ap: WifiApInput, allAps: WifiApInput[]): string[] {
  if (!ap.channel) return []
  const conflicts: string[] = []

  for (const other of allAps) {
    if (other.id === ap.id || !other.channel) continue
    const diff = Math.abs(ap.channel - other.channel)

    // 2.4 GHz: channels overlap if within 4 channels
    // 5/6 GHz: co-channel only (same channel)
    const band = ap.band === '2.4' ? '2.4' : '5'
    const isConflict = band === '2.4' ? diff < 5 : diff === 0

    if (isConflict) conflicts.push(other.id)
  }

  return conflicts
}

// ---- Main Engine ----

/**
 * Run the full WiFi heatmap calculation.
 * Returns a 2D grid of RSSI values + summary statistics.
 */
export function runWifiHeatmap(input: HeatmapInput): HeatmapOutput {
  const { aps, walls, config } = input
  const { gridResolution, canvasWidth, canvasHeight, scalePxPerFt, targetBand } = config

  const cols = Math.ceil(canvasWidth / gridResolution)
  const rows = Math.ceil(canvasHeight / gridResolution)

  const grid: HeatmapCell[][] = []
  let totalRssi = 0
  let minRssi = 0
  let maxRssi = -200
  const apPrimaryCounts: Record<string, number> = {}

  for (const ap of aps) {
    apPrimaryCounts[ap.id] = 0
  }

  for (let r = 0; r < rows; r++) {
    const row: HeatmapCell[] = []
    for (let c = 0; c < cols; c++) {
      const px = c * gridResolution + gridResolution / 2
      const py = r * gridResolution + gridResolution / 2

      let bestRssi = -200
      let bestApId = ''

      for (const ap of aps) {
        const band = resolveApBand(ap, targetBand)
        const rssi = calcRssiAtPoint(ap, px, py, walls, band, scalePxPerFt)
        if (rssi > bestRssi) {
          bestRssi = rssi
          bestApId = ap.id
        }
      }

      // Noise floor based on first AP's environment (or office default)
      const noiseFloor = NOISE_FLOOR[aps[0]?.environment ?? 'office']
      const snr = bestRssi - noiseFloor

      row.push({ x: px, y: py, rssi: bestRssi, bestApId, snr })

      totalRssi += bestRssi
      if (bestRssi < minRssi) minRssi = bestRssi
      if (bestRssi > maxRssi) maxRssi = bestRssi
      if (bestApId) apPrimaryCounts[bestApId] = (apPrimaryCounts[bestApId] ?? 0) + 1
    }
    grid.push(row)
  }

  const totalCells = rows * cols
  const avgRssi = totalCells > 0 ? totalRssi / totalCells : -100

  // Classify cells
  let excellentCells = 0
  let goodCells = 0
  let fairCells = 0
  let poorCells = 0
  let deadCells = 0

  for (const row of grid) {
    for (const cell of row) {
      if (cell.rssi >= RSSI_THRESHOLDS.excellent) excellentCells++
      else if (cell.rssi >= RSSI_THRESHOLDS.good) goodCells++
      else if (cell.rssi >= RSSI_THRESHOLDS.fair) fairCells++
      else if (cell.rssi >= RSSI_THRESHOLDS.poor) poorCells++
      else deadCells++
    }
  }

  const coveragePct = totalCells > 0
    ? ((excellentCells + goodCells + fairCells) / totalCells) * 100
    : 0

  // Per-AP results
  const perAp: ApCoverageResult[] = aps.map(ap => {
    const band = resolveApBand(ap, targetBand)
    // Approximate max range: solve FSPL for -70 dBm threshold
    const eirp = ap.tx_power_dbm + ap.antenna_gain_dbi
    const maxPathLoss = eirp - RSSI_THRESHOLDS.fair // -70 dBm
    const freqMhz = BAND_FREQ_MHZ[band] ?? 5500
    // d = 10^((pathLoss - 20·log10(f) + 27.55) / 20)   in meters
    const maxDistMeters = Math.pow(10, (maxPathLoss - 20 * Math.log10(freqMhz) + 27.55) / 20)
    const maxRangeFt = maxDistMeters / 0.3048

    return {
      apId: ap.id,
      label: ap.label,
      primaryCells: apPrimaryCounts[ap.id] ?? 0,
      maxRange_ft: Math.round(maxRangeFt),
      channelConflicts: findChannelConflicts(ap, aps),
    }
  })

  return {
    grid,
    summary: {
      totalCells,
      excellentCells,
      goodCells,
      fairCells,
      poorCells,
      deadCells,
      coveragePct: Math.round(coveragePct * 10) / 10,
      minRssi: Math.round(minRssi),
      maxRssi: Math.round(maxRssi),
      avgRssi: Math.round(avgRssi * 10) / 10,
    },
    perAp,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Interpolate a color for an RSSI value from the heatmap color stops.
 */
export function rssiToColor(rssi: number): string {
  if (rssi >= HEATMAP_COLORS[0].rssi) return HEATMAP_COLORS[0].color
  if (rssi <= HEATMAP_COLORS[HEATMAP_COLORS.length - 1].rssi) {
    return HEATMAP_COLORS[HEATMAP_COLORS.length - 1].color
  }

  for (let i = 0; i < HEATMAP_COLORS.length - 1; i++) {
    const upper = HEATMAP_COLORS[i]
    const lower = HEATMAP_COLORS[i + 1]
    if (rssi >= lower.rssi && rssi <= upper.rssi) {
      const t = (rssi - lower.rssi) / (upper.rssi - lower.rssi)
      return interpolateHex(lower.color, upper.color, t)
    }
  }

  return '#1c1917'
}

function interpolateHex(c1: string, c2: string, t: number): string {
  const r1 = parseInt(c1.slice(1, 3), 16)
  const g1 = parseInt(c1.slice(3, 5), 16)
  const b1 = parseInt(c1.slice(5, 7), 16)
  const r2 = parseInt(c2.slice(1, 3), 16)
  const g2 = parseInt(c2.slice(3, 5), 16)
  const b2 = parseInt(c2.slice(5, 7), 16)

  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const b = Math.round(b1 + (b2 - b1) * t)

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

/**
 * Validate heatmap input — returns array of error messages.
 */
export function validateHeatmapInput(input: HeatmapInput): string[] {
  const errors: string[] = []

  if (input.aps.length === 0) {
    errors.push('At least one access point is required')
  }

  for (const ap of input.aps) {
    if (ap.tx_power_dbm < 0 || ap.tx_power_dbm > 30) {
      errors.push(`AP "${ap.label}": TX power ${ap.tx_power_dbm} dBm is outside typical range (0-30)`)
    }
    if (ap.channel_width > 160) {
      errors.push(`AP "${ap.label}": Channel width ${ap.channel_width} MHz exceeds WiFi 6E max (160)`)
    }
  }

  if (input.config.gridResolution < 2) {
    errors.push('Grid resolution must be at least 2px')
  }

  return errors
}
