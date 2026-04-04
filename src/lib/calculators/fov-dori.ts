/**
 * Panteray — FOV / DORI Calculator Engine
 *
 * Calculates field of view, pixels per foot, DORI classification,
 * tilt angle, and blind spot distance for security cameras.
 *
 * Dual-mode: standalone (manual input) and integrated (from canvas device data).
 *
 * ZERO DEFAULTS:
 * - Equipment specs come from device library only.
 * - Site conditions (mount height, target distance) come from user input on canvas only.
 * - Floor plan scale comes from calibrated floor plan only.
 * - If any required field is missing, the engine will not run — the UI
 *   prompts the user to fill in what's missing via validateFovInput().
 */

// ---- Input Types ----

export interface FovDoriInput {
  /** Sensor resolution width (pixels) */
  resolutionW: number;
  /** Sensor resolution height (pixels) */
  resolutionH: number;
  /** Sensor physical width (mm) */
  sensorW: number;
  /** Sensor physical height (mm) */
  sensorH: number;
  /** Focal length (mm) */
  focalLength: number;
  /** Camera mount height above ground (ft) */
  mountHeight: number;
  /** Target distance from camera (ft) */
  targetDistance: number;
  /** Target PPF for identification (default 76) */
  targetPpf?: number;
  /** Camera tilt angle in degrees (0 = horizontal, positive = downward) */
  tiltAngle?: number;
}

// ---- Output Types ----

export interface FovDoriOutput {
  /** Horizontal field of view angle (degrees) */
  hFov: number;
  /** Vertical field of view angle (degrees) */
  vFov: number;
  /** Horizontal scene width at target distance (ft) */
  sceneWidthFt: number;
  /** Vertical scene height at target distance (ft) */
  sceneHeightFt: number;
  /** Pixels per foot at target distance (horizontal) */
  ppf: number;
  /** DORI classification at target distance */
  dpiClassification: DoriClassification;
  /** Required focal length to achieve target PPF at target distance */
  requiredFocalLengthMm: number;
  /** Recommended tilt angle for target (degrees) */
  recommendedTiltDeg: number;
  /** Blind spot distance from base of camera (ft) */
  blindSpotFt: number;
  /** Maximum identification distance at target PPF */
  maxIdentificationDistFt: number;
  /** Maximum recognition distance */
  maxRecognitionDistFt: number;
  /** Maximum observation distance */
  maxObservationDistFt: number;
  /** Maximum detection distance */
  maxDetectionDistFt: number;
  /** Maximum inspection distance (305 PPF forensic detail) */
  maxInspectionDistFt: number;
  /** Maximum monitor distance (4 PPF scene awareness) */
  maxMonitorDistFt: number;
}

export type DoriClassification = 'inspection' | 'identification' | 'recognition' | 'observation' | 'detection' | 'monitor' | 'none';

// ---- DORI PPF Thresholds (IEC 62676-4) ----

export const DORI_THRESHOLDS = {
  inspection: 305,      // PPF >= 305: forensic-level detail (IEC 62676-4)
  identification: 76,   // PPF >= 76: identify a person
  recognition: 38,      // PPF >= 38: recognize a known person
  observation: 19,       // PPF >= 19: observe activity
  detection: 8,          // PPF >= 8: detect presence
  monitor: 4,            // PPF >= 4: general scene awareness
};

// ---- Constants ----

const MM_PER_FT = 304.8;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

// ---- Common sensor sizes (mm) for reference ----

export const COMMON_SENSORS: { label: string; w: number; h: number }[] = [
  { label: '1/3"', w: 4.8, h: 3.6 },
  { label: '1/2.8"', w: 5.14, h: 3.86 },
  { label: '1/2.7"', w: 5.37, h: 4.04 },
  { label: '1/2.5"', w: 5.76, h: 4.29 },
  { label: '1/2"', w: 6.4, h: 4.8 },
  { label: '1/1.8"', w: 7.18, h: 5.32 },
  { label: '2/3"', w: 8.8, h: 6.6 },
  { label: '1"', w: 12.8, h: 9.6 },
];

// ---- Engine ----

/**
 * Main FOV/DORI calculation.
 */
export function calculateFovDori(input: FovDoriInput): FovDoriOutput {
  const {
    resolutionW,
    resolutionH,
    sensorW,
    sensorH,
    focalLength,
    mountHeight,
    targetDistance,
    targetPpf = 76,
  } = input;

  // 1. Field of View angles
  const hFov = 2 * Math.atan(sensorW / (2 * focalLength)) * RAD_TO_DEG;
  const vFov = 2 * Math.atan(sensorH / (2 * focalLength)) * RAD_TO_DEG;

  // 2. Scene dimensions at target distance (ft)
  const targetDistMm = targetDistance * MM_PER_FT;
  const sceneWidthMm = 2 * targetDistMm * Math.tan((hFov / 2) * DEG_TO_RAD);
  const sceneHeightMm = 2 * targetDistMm * Math.tan((vFov / 2) * DEG_TO_RAD);
  const sceneWidthFt = sceneWidthMm / MM_PER_FT;
  const sceneHeightFt = sceneHeightMm / MM_PER_FT;

  // 3. Pixels per foot
  const ppf = sceneWidthFt > 0 ? resolutionW / sceneWidthFt : 0;

  // 4. DORI classification
  const dpiClassification = classifyDori(ppf);

  // 5. Required focal length for target PPF at target distance
  const requiredSceneWidthFt = resolutionW / targetPpf;
  const requiredSceneWidthMm = requiredSceneWidthFt * MM_PER_FT;
  const requiredFocalLengthMm = (sensorW * targetDistMm) / requiredSceneWidthMm;

  // 6. Tilt angle (from horizontal, looking down at target on ground)
  const recommendedTiltDeg = mountHeight > 0 && targetDistance > 0
    ? Math.atan(mountHeight / targetDistance) * RAD_TO_DEG
    : 0;

  // 7. Blind spot (area directly below camera that's not visible)
  const effectiveTilt = input.tiltAngle ?? recommendedTiltDeg;
  const halfVFovRad = (vFov / 2) * DEG_TO_RAD;
  const tiltRad = effectiveTilt * DEG_TO_RAD;
  const nearEdgeAngle = tiltRad + halfVFovRad;
  const blindSpotFt = nearEdgeAngle < Math.PI / 2
    ? mountHeight / Math.tan(nearEdgeAngle)
    : 0;

  // 8. Max distances per DORI tier
  const maxInspectionDistFt = calculateMaxDistance(resolutionW, sensorW, focalLength, DORI_THRESHOLDS.inspection);
  const maxIdentificationDistFt = calculateMaxDistance(resolutionW, sensorW, focalLength, DORI_THRESHOLDS.identification);
  const maxRecognitionDistFt = calculateMaxDistance(resolutionW, sensorW, focalLength, DORI_THRESHOLDS.recognition);
  const maxObservationDistFt = calculateMaxDistance(resolutionW, sensorW, focalLength, DORI_THRESHOLDS.observation);
  const maxDetectionDistFt = calculateMaxDistance(resolutionW, sensorW, focalLength, DORI_THRESHOLDS.detection);
  const maxMonitorDistFt = calculateMaxDistance(resolutionW, sensorW, focalLength, DORI_THRESHOLDS.monitor);

  return {
    hFov: round(hFov),
    vFov: round(vFov),
    sceneWidthFt: round(sceneWidthFt),
    sceneHeightFt: round(sceneHeightFt),
    ppf: round(ppf),
    dpiClassification,
    requiredFocalLengthMm: round(requiredFocalLengthMm, 1),
    recommendedTiltDeg: round(recommendedTiltDeg),
    blindSpotFt: round(blindSpotFt),
    maxIdentificationDistFt: round(maxIdentificationDistFt),
    maxRecognitionDistFt: round(maxRecognitionDistFt),
    maxObservationDistFt: round(maxObservationDistFt),
    maxDetectionDistFt: round(maxDetectionDistFt),
    maxInspectionDistFt: round(maxInspectionDistFt),
    maxMonitorDistFt: round(maxMonitorDistFt),
  };
}

/**
 * Calculate the FOV cone parameters for canvas rendering.
 * Returns angle and radius in canvas units (pixels based on scale).
 */
export function getFovConeParams(
  hFov: number,
  maxDistanceFt: number,
  scalePxPerFt: number,
): { angleDeg: number; radiusPx: number } {
  return {
    angleDeg: hFov,
    radiusPx: maxDistanceFt * scalePxPerFt,
  };
}

/**
 * Get FOV cone tiers for multi-colored rendering.
 * Returns identification (green), recognition (yellow), observation (orange), detection (red) zones.
 */
export function getFovConeTiers(
  input: FovDoriInput,
): { tier: DoriClassification; distanceFt: number; color: string; opacity: number }[] {
  const { resolutionW, sensorW, focalLength } = input;

  return [
    {
      tier: 'monitor' as DoriClassification,
      distanceFt: calculateMaxDistance(resolutionW, sensorW, focalLength, DORI_THRESHOLDS.monitor),
      color: '#6b7280',
      opacity: 0.04,
    },
    {
      tier: 'detection',
      distanceFt: calculateMaxDistance(resolutionW, sensorW, focalLength, DORI_THRESHOLDS.detection),
      color: '#ef4444',
      opacity: 0.06,
    },
    {
      tier: 'observation',
      distanceFt: calculateMaxDistance(resolutionW, sensorW, focalLength, DORI_THRESHOLDS.observation),
      color: '#f97316',
      opacity: 0.09,
    },
    {
      tier: 'recognition',
      distanceFt: calculateMaxDistance(resolutionW, sensorW, focalLength, DORI_THRESHOLDS.recognition),
      color: '#eab308',
      opacity: 0.12,
    },
    {
      tier: 'identification',
      distanceFt: calculateMaxDistance(resolutionW, sensorW, focalLength, DORI_THRESHOLDS.identification),
      color: '#22c55e',
      opacity: 0.15,
    },
    {
      tier: 'inspection' as DoriClassification,
      distanceFt: calculateMaxDistance(resolutionW, sensorW, focalLength, DORI_THRESHOLDS.inspection),
      color: '#8b5cf6',
      opacity: 0.20,
    },
  ];
}

// ---- Integrated Mode: Canvas → FOV Bridge ----

/**
 * Shape of a placed canvas device with optional joined library item data.
 */
export interface CanvasFovDevice {
  id: string;
  label: string;
  category: string;
  properties: Record<string, unknown> | null;
  /** Joined from device_library_items via device_library_item_id */
  libraryItem?: {
    resolution?: string | null;
    specs?: Record<string, unknown> | null;
  } | null;
}

/**
 * Partial FOV input returned by the bridge.
 * ALL fields may be undefined — nothing is defaulted.
 * Equipment specs come from device library. Site conditions from canvas input.
 */
export type FovDoriInputPartial = {
  [K in keyof FovDoriInput]?: FovDoriInput[K];
};

/** All fields required to run the FOV calculator. */
const REQUIRED_FOV_FIELDS = [
  'resolutionW',
  'resolutionH',
  'sensorW',
  'sensorH',
  'focalLength',
  'mountHeight',
  'targetDistance',
] as const;

/**
 * Validation result — tells the UI which fields are missing.
 */
export interface FovValidation {
  valid: boolean;
  missingFields: string[];
}

/**
 * Convert a placed canvas device into a partial FOV input.
 *
 * Priority chain:
 *   1. device.properties (user overrides on this specific placement)
 *   2. libraryItem.specs (manufacturer defaults from device library)
 *   3. undefined — user must provide via the UI
 *
 * Nothing is defaulted. If the data isn't there, the field stays undefined.
 */
export function canvasDeviceToFovInput(device: CanvasFovDevice): FovDoriInputPartial {
  const props = (device.properties ?? {}) as Record<string, unknown>;
  const libSpecs = (device.libraryItem?.specs ?? {}) as Record<string, unknown>;

  return {
    resolutionW:
      (props.resolution_w as number) ||
      (libSpecs.resolution_w as number) ||
      undefined,
    resolutionH:
      (props.resolution_h as number) ||
      (libSpecs.resolution_h as number) ||
      undefined,
    sensorW:
      (props.sensor_w as number) ||
      (libSpecs.sensor_w as number) ||
      undefined,
    sensorH:
      (props.sensor_h as number) ||
      (libSpecs.sensor_h as number) ||
      undefined,
    focalLength:
      (props.focal_length as number) ||
      (libSpecs.focal_length as number) ||
      undefined,
    mountHeight:
      (props.mount_height as number) || undefined,
    targetDistance:
      (props.target_distance as number) || undefined,
    tiltAngle:
      (props.tilt_angle as number) || undefined,
  };
}

/**
 * Check if a partial FOV input has all required fields.
 * Returns which fields are missing so the UI can prompt the user.
 */
export function validateFovInput(partial: FovDoriInputPartial): FovValidation {
  const missingFields: string[] = [];
  for (const field of REQUIRED_FOV_FIELDS) {
    if (partial[field] === undefined || partial[field] === null || partial[field] === 0) {
      missingFields.push(field);
    }
  }
  return { valid: missingFields.length === 0, missingFields };
}

// ---- Public helpers ----

export function classifyDori(ppf: number): DoriClassification {
  if (ppf >= DORI_THRESHOLDS.inspection) return 'inspection';
  if (ppf >= DORI_THRESHOLDS.identification) return 'identification';
  if (ppf >= DORI_THRESHOLDS.recognition) return 'recognition';
  if (ppf >= DORI_THRESHOLDS.observation) return 'observation';
  if (ppf >= DORI_THRESHOLDS.detection) return 'detection';
  if (ppf >= DORI_THRESHOLDS.monitor) return 'monitor';
  return 'none';
}

/**
 * Calculate PPF at an arbitrary distance from camera.
 * Used for PPF-at-cursor on canvas.
 */
export function calculatePpfAtDistance(
  resolutionW: number,
  sensorW: number,
  focalLength: number,
  distanceFt: number,
): number {
  if (distanceFt <= 0 || sensorW <= 0 || focalLength <= 0) return 0;
  const distMm = distanceFt * MM_PER_FT;
  const sceneWidthMm = 2 * distMm * Math.tan(Math.atan(sensorW / (2 * focalLength)));
  const sceneWidthFt = sceneWidthMm / MM_PER_FT;
  return sceneWidthFt > 0 ? round(resolutionW / sceneWidthFt) : 0;
}

function calculateMaxDistance(
  resolutionW: number,
  sensorW: number,
  focalLength: number,
  targetPpf: number,
): number {
  if (sensorW <= 0 || targetPpf <= 0 || resolutionW <= 0 || focalLength <= 0) return 0;
  const sceneWidthFt = resolutionW / targetPpf;
  const sceneWidthMm = sceneWidthFt * MM_PER_FT;
  // distance = focalLength * sceneWidth / sensorW (thin lens formula)
  const distMm = (focalLength * sceneWidthMm) / sensorW;
  return distMm / MM_PER_FT;
}

function round(value: number, decimals: number = 1): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
