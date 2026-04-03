/** Shared FOV tier + device FOV payload (canvas + map layers). */

export interface FovTier {
  distanceFt: number
  color: string
  opacity: number
}

export interface DeviceFovData {
  hFov: number
  rotation: number
  tiers: FovTier[]
  sensorAngles?: number[]
  resolutionW?: number
  sensorW?: number
  focalLength?: number
  blindSpotFt?: number
  colorHex?: string
  /** Per-imager overrides for multisensor cameras */
  perImagerData?: Array<{ tiers: FovTier[]; hFov: number; colorHex?: string }>
}
