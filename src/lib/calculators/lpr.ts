/**
 * Panteray — LPR Calculator Engine
 *
 * Calculates required focal length, shutter speed, capture angle,
 * and recommended FPS for license plate recognition cameras.
 *
 * Dual-mode: standalone (manual input) and integrated (from canvas device data).
 *
 * ZERO DEFAULTS:
 * - Equipment specs come from device library only.
 * - Site conditions come from user input on canvas only.
 * - Floor plan PPF comes from calibrated floor plan only.
 * - If any required field is missing, the engine will not run — the UI
 *   prompts the user to fill in what's missing via validateLprInput().
 */

export interface LprInput {
  resolutionW: number;
  resolutionH: number;
  sensorW: number;
  focalLength: number;
  mountHeight: number;
  targetDistance: number;
  vehicleSpeedMph: number;
  laneCount: number;
}

export interface LprOutput {
  requiredFocalLengthMm: number;
  requiredShutterSpeed: string;
  captureAngleDeg: number;
  captureAngleStatus: 'pass' | 'warning' | 'fail';
  recommendedFps: number;
  ppfAtTarget: number;
  plateWidthPx: number;
  plateHeightPx: number;
  opticalTarget: string;
  warnings: string[];
}

const PLATE_WIDTH_INCHES = 12;
const PLATE_HEIGHT_INCHES = 6;
const MIN_PLATE_PX = 32;
const MAX_CAPTURE_ANGLE_DEG = 30;
const MM_PER_FT = 304.8;

export function calculateLpr(input: LprInput): LprOutput {
  const { resolutionW, sensorW, focalLength, mountHeight, targetDistance, vehicleSpeedMph, laneCount } = input;
  const warnings: string[] = [];

  const targetDistMm = targetDistance * MM_PER_FT;
  const sceneWidthMm = 2 * targetDistMm * Math.tan(Math.atan(sensorW / (2 * focalLength)));
  const sceneWidthFt = sceneWidthMm / MM_PER_FT;
  const ppf = sceneWidthFt > 0 ? resolutionW / sceneWidthFt : 0;
  const plateWidthFt = PLATE_WIDTH_INCHES / 12;
  const plateWidthPx = Math.round(ppf * plateWidthFt);
  const plateHeightPx = Math.round(ppf * (PLATE_HEIGHT_INCHES / 12));

  const requiredSceneWidthFt = (resolutionW * plateWidthFt) / MIN_PLATE_PX;
  const requiredSceneWidthMm = requiredSceneWidthFt * MM_PER_FT;
  const requiredFocalLengthMm = (sensorW * targetDistMm) / requiredSceneWidthMm;

  const captureAngleDeg = Math.atan(mountHeight / targetDistance) * (180 / Math.PI);
  let captureAngleStatus: 'pass' | 'warning' | 'fail' = 'pass';
  if (captureAngleDeg > MAX_CAPTURE_ANGLE_DEG) {
    captureAngleStatus = 'fail';
    warnings.push(`Capture angle ${captureAngleDeg.toFixed(1)} exceeds ${MAX_CAPTURE_ANGLE_DEG} max. Lower mount height or increase distance.`);
  } else if (captureAngleDeg > 25) {
    captureAngleStatus = 'warning';
    warnings.push(`Capture angle ${captureAngleDeg.toFixed(1)} approaching limit. Consider adjustments.`);
  }

  const speedFtPerSec = vehicleSpeedMph * 5280 / 3600;
  const maxBlurPx = 2;
  const requiredShutterSec = (maxBlurPx / ppf) / speedFtPerSec;
  const shutterDenominator = Math.ceil(1 / requiredShutterSec);
  const requiredShutterSpeed = `1/${shutterDenominator}`;

  const captureWindowFt = sceneWidthFt * 0.6;
  const captureWindowSec = captureWindowFt / speedFtPerSec;
  const recommendedFps = Math.max(10, Math.ceil(3 / captureWindowSec));

  if (plateWidthPx < MIN_PLATE_PX) {
    warnings.push(`Plate width ${plateWidthPx}px below ${MIN_PLATE_PX}px minimum. Increase focal length or reduce distance.`);
  }

  const opticalTarget = laneCount <= 1 ? 'Single-lane capture' : `Multi-lane: ${laneCount} lanes — consider wider FOV or multiple cameras`;

  return {
    requiredFocalLengthMm: round(requiredFocalLengthMm),
    requiredShutterSpeed,
    captureAngleDeg: round(captureAngleDeg),
    captureAngleStatus,
    recommendedFps,
    ppfAtTarget: round(ppf),
    plateWidthPx,
    plateHeightPx,
    opticalTarget,
    warnings,
  };
}

// ---- Integrated Mode: Canvas → LPR Bridge ----

/**
 * All required fields for LPR calculation.
 * Equipment fields: from device library via device_library_item_id join.
 * Site condition fields: from user input on canvas (device.properties).
 * No defaults for anything.
 */
const REQUIRED_FIELDS = [
  'resolutionW',
  'resolutionH',
  'sensorW',
  'focalLength',
  'mountHeight',
  'targetDistance',
  'vehicleSpeedMph',
  'laneCount',
] as const;

/**
 * Shape of a placed canvas device with optional joined library item data.
 * Matches the join pattern: design_devices LEFT JOIN device_library_items.
 */
export interface CanvasLprDevice {
  id: string;
  label: string;
  category: string;
  properties: Record<string, unknown> | null;
  /** Joined from device_library_items via device_library_item_id */
  libraryItem?: {
    resolution?: string | null;
    specs?: Record<string, unknown> | null;
    fps?: string | null;
    wattage?: number | null;
  } | null;
}

/**
 * Partial LPR input returned by the bridge.
 * ALL fields may be undefined — nothing is defaulted.
 */
export type LprInputPartial = {
  [K in keyof LprInput]?: number;
};

/**
 * Validation result — tells the UI which fields are missing.
 */
export interface LprValidation {
  valid: boolean;
  missingFields: string[];
}

/**
 * Convert a placed canvas device into a partial LPR input.
 *
 * Priority chain for equipment fields:
 *   1. device.properties (user overrides on this specific placement)
 *   2. libraryItem.specs  (manufacturer defaults from device library)
 *   3. undefined — user must provide via the UI
 *
 * Priority chain for site condition fields:
 *   1. device.properties (user input on canvas)
 *   2. undefined — user must provide via the UI
 *
 * Nothing is defaulted. If the data isn't there, the field stays undefined
 * and validateLprInput() will flag it.
 */
export function canvasDeviceToLprInput(device: CanvasLprDevice): LprInputPartial {
  const props = (device.properties ?? {}) as Record<string, unknown>;
  const libSpecs = (device.libraryItem?.specs ?? {}) as Record<string, unknown>;

  return {
    // Equipment specs: properties → library → undefined
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
    focalLength:
      (props.focal_length as number) ||
      (libSpecs.focal_length as number) ||
      undefined,
    // Site conditions: properties only → undefined
    mountHeight:
      (props.mount_height as number) || undefined,
    targetDistance:
      (props.lpr_target_distance as number) || undefined,
    vehicleSpeedMph:
      (props.lpr_vehicle_speed_mph as number) || undefined,
    laneCount:
      (props.lpr_lane_count as number) || undefined,
  };
}

/**
 * Check if a partial LPR input has ALL required fields.
 * Returns which fields are missing so the UI can prompt the user.
 * ALL fields are required — nothing is optional, nothing is defaulted.
 */
export function validateLprInput(partial: LprInputPartial): LprValidation {
  const missingFields: string[] = [];
  for (const field of REQUIRED_FIELDS) {
    if (partial[field] === undefined || partial[field] === null || partial[field] === 0) {
      missingFields.push(field);
    }
  }
  return { valid: missingFields.length === 0, missingFields };
}

/**
 * Filter placed devices to only LPR-flagged cameras and convert to partial inputs.
 * A device is LPR-flagged if category === 'cctv' AND properties.is_lpr === true.
 */
export function canvasDevicesToLprInputs(
  devices: CanvasLprDevice[],
): { deviceId: string; label: string; input: LprInputPartial; validation: LprValidation }[] {
  return devices
    .filter((d) => d.category === 'cctv' && (d.properties as Record<string, unknown>)?.is_lpr === true)
    .map((d) => {
      const input = canvasDeviceToLprInput(d);
      const validation = validateLprInput(input);
      return { deviceId: d.id, label: d.label, input, validation };
    });
}

function round(v: number, d: number = 1): number { const f = Math.pow(10, d); return Math.round(v * f) / f; }
