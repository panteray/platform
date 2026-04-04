/**
 * Panteray — System / Storage Calculator Engine
 *
 * Calculates bandwidth, storage, RAID, PoE budget, and 5-year TCO
 * for CCTV systems. Dual-mode: standalone + integrated (aggregates
 * all placed cameras on canvas).
 *
 * ZERO DEFAULTS:
 * - Equipment specs come from device library only.
 * - Site/project settings (retention, RAID, drive size) come from user input only.
 * - TCO pricing is optional — only calculated when user provides pricing.
 * - If any required camera field is missing, that camera returns zeroes and
 *   validateStorageInput() flags it.
 */

// ---- Input Types ----

export interface CameraSpec {
  cameraId?: string;
  label?: string;
  resolutionLabel?: string;
  resolutionW?: number;
  resolutionH?: number;
  fps?: number;
  compression?: Compression;
  smartCodec?: boolean;
  motionPercent?: number;
  poeStandard?: PoeStandard;
  poeWatts?: number;
}

export type Compression = 'h264' | 'h265' | 'h265plus';
export type PoeStandard = 'af' | 'at' | 'bt' | 'none';

export interface SystemStorageInput {
  cameras: CameraSpec[];
  retentionDays: number;
  raidLevel: 5 | 6;
  driveSizeTB: number;
  /** Optional — TCO only calculated when provided */
  cloudStorageCostPerTBMonth?: number;
  /** Optional — TCO only calculated when provided */
  localNvrCostPerTB?: number;
}

// ---- Output Types ----

export interface SystemStorageOutput {
  perCamera: CameraResult[];
  totalCameras: number;
  totalBandwidthMbps: number;
  totalDailyStorageGB: number;
  totalStorageTB: number;
  raidAnalysis: RaidAnalysis;
  poeBudget: PoeBudget;
  tco: TcoAnalysis | null;
}

export interface CameraResult {
  cameraId?: string;
  label?: string;
  bitrateKbps: number;
  bandwidthMbps: number;
  dailyStorageGB: number;
  retentionStorageGB: number;
}

export interface RaidAnalysis {
  raidLevel: 5 | 6;
  usableStorageTB: number;
  rawStorageTB: number;
  driveSizeTB: number;
  driveCount: number;
  parityDrives: number;
  usableDrives: number;
}

export interface PoeBudget {
  totalWatts: number;
  cameraCount: number;
  byStandard: { standard: PoeStandard; count: number; watts: number }[];
  recommendedSwitchWatts: number;
}

export interface TcoAnalysis {
  localNvrCost: number;
  cloudMonthlyCost: number;
  cloud5YearCost: number;
  localVsCloudSavings: number;
  recommendation: string;
}

// ---- Bitrate estimation tables (industry standard reference data) ----

const BITRATE_TABLE: Record<string, Record<Compression, number>> = {
  '2mp':   { h264: 4000, h265: 2000, h265plus: 1200 },
  '3mp':   { h264: 5000, h265: 2500, h265plus: 1500 },
  '4mp':   { h264: 6000, h265: 3000, h265plus: 1800 },
  '5mp':   { h264: 8000, h265: 4000, h265plus: 2400 },
  '6mp':   { h264: 9000, h265: 4500, h265plus: 2700 },
  '8mp':   { h264: 12000, h265: 6000, h265plus: 3600 },
  '4k':    { h264: 16000, h265: 8000, h265plus: 4800 },
  '12mp':  { h264: 20000, h265: 10000, h265plus: 6000 },
  '16mp':  { h264: 25000, h265: 12500, h265plus: 7500 },
};

function resolutionToKey(label: string, w: number, h?: number): string | null {
  const lower = label.toLowerCase().replace(/\s/g, '');
  if (lower in BITRATE_TABLE) return lower;
  const effectiveH = h || Math.round(w * 9 / 16);
  const mp = (w * effectiveH) / 1000000;
  if (mp <= 2.5) return '2mp';
  if (mp <= 3.5) return '3mp';
  if (mp <= 4.5) return '4mp';
  if (mp <= 5.5) return '5mp';
  if (mp <= 6.5) return '6mp';
  if (mp <= 9) return '8mp';
  if (mp <= 13) return '12mp';
  if (mp > 13) return '16mp';
  return null;
}

/** IEEE 802.3 standard max wattage per PoE class (reference data, not equipment defaults) */
const POE_WATTS: Record<PoeStandard, number> = {
  af: 15.4,
  at: 30,
  bt: 60,
  none: 0,
};

// ---- Validation ----

/** Required fields on each camera spec for the engine to run. */
const REQUIRED_CAMERA_FIELDS = [
  'resolutionW',
  'resolutionH',
  'fps',
  'compression',
  'poeWatts',
] as const;

export interface StorageCameraValidation {
  cameraId?: string;
  label?: string;
  valid: boolean;
  missingFields: string[];
}

export interface StorageValidation {
  valid: boolean;
  cameras: StorageCameraValidation[];
  missingInputFields: string[];
}

/**
 * Validate all cameras + system input before running the engine.
 * Every camera must have resolution, fps, compression, and poe data.
 * System must have retention, raid, and drive size.
 * TCO pricing is optional — not flagged if missing.
 */
export function validateStorageInput(input: { cameras: CameraSpec[]; retentionDays?: number; raidLevel?: number; driveSizeTB?: number }): StorageValidation {
  const missingInputFields: string[] = [];
  if (!input.retentionDays) missingInputFields.push('retentionDays');
  if (!input.raidLevel) missingInputFields.push('raidLevel');
  if (!input.driveSizeTB) missingInputFields.push('driveSizeTB');

  const cameras: StorageCameraValidation[] = input.cameras.map((cam) => {
    const missing: string[] = [];
    for (const field of REQUIRED_CAMERA_FIELDS) {
      const val = cam[field];
      if (val === undefined || val === null || val === 0) {
        missing.push(field);
      }
    }
    if (!cam.resolutionLabel && !cam.resolutionW) {
      if (!missing.includes('resolutionW')) missing.push('resolutionW');
    }
    return { cameraId: cam.cameraId, label: cam.label, valid: missing.length === 0, missingFields: missing };
  });

  const allCamerasValid = cameras.every((c) => c.valid);
  return { valid: allCamerasValid && missingInputFields.length === 0, cameras, missingInputFields };
}

// ---- Engine ----

export function calculateSystemStorage(input: SystemStorageInput): SystemStorageOutput {
  const { cameras, retentionDays, raidLevel, driveSizeTB } = input;

  const perCamera: CameraResult[] = cameras.map((cam) => {
    const resLabel = cam.resolutionLabel || '';
    const resW = cam.resolutionW || 0;
    const resH = cam.resolutionH || 0;
    const resKey = resolutionToKey(resLabel, resW, resH || undefined);
    const compression = cam.compression || 'h265';
    const baseBitrate = resKey ? (BITRATE_TABLE[resKey]?.[compression] ?? null) : null;

    if (baseBitrate === null) {
      return {
        cameraId: cam.cameraId,
        label: cam.label,
        bitrateKbps: 0,
        bandwidthMbps: 0,
        dailyStorageGB: 0,
        retentionStorageGB: 0,
      };
    }

    const fps = cam.fps || 0;
    const fpsMultiplier = fps / 30;
    const motionMultiplier = cam.smartCodec ? ((cam.motionPercent || 100) / 100) : 1;
    const bitrateKbps = baseBitrate * fpsMultiplier * motionMultiplier;
    const bandwidthMbps = bitrateKbps / 1000;
    const dailyStorageGB = (bitrateKbps / 8) * 86400 / (1024 * 1024);
    const retentionStorageGB = dailyStorageGB * retentionDays;

    return {
      cameraId: cam.cameraId,
      label: cam.label,
      bitrateKbps: round(bitrateKbps),
      bandwidthMbps: round(bandwidthMbps, 2),
      dailyStorageGB: round(dailyStorageGB, 2),
      retentionStorageGB: round(retentionStorageGB, 2),
    };
  });

  const totalBandwidthMbps = perCamera.reduce((s, c) => s + c.bandwidthMbps, 0);
  const totalDailyStorageGB = perCamera.reduce((s, c) => s + c.dailyStorageGB, 0);
  const totalStorageTB = perCamera.reduce((s, c) => s + c.retentionStorageGB, 0) / 1024;

  const raidAnalysis = calculateRaid(totalStorageTB, raidLevel, driveSizeTB);
  const poeBudget = calculatePoe(cameras);

  // TCO only calculated when user provides pricing — not defaulted
  const tco = (input.cloudStorageCostPerTBMonth != null && input.localNvrCostPerTB != null)
    ? calculateTco(totalStorageTB, input.cloudStorageCostPerTBMonth, input.localNvrCostPerTB)
    : null;

  return {
    perCamera,
    totalCameras: cameras.length,
    totalBandwidthMbps: round(totalBandwidthMbps, 2),
    totalDailyStorageGB: round(totalDailyStorageGB, 2),
    totalStorageTB: round(totalStorageTB, 2),
    raidAnalysis,
    poeBudget,
    tco,
  };
}

function calculateRaid(requiredTB: number, raidLevel: 5 | 6, driveSizeTB: number): RaidAnalysis {
  const parityDrives = raidLevel === 5 ? 1 : 2;
  const minDrives = parityDrives + 1;
  let driveCount = minDrives;

  while ((driveCount - parityDrives) * driveSizeTB < requiredTB && driveCount < 32) {
    driveCount++;
  }

  const usableDrives = driveCount - parityDrives;
  const usableStorageTB = usableDrives * driveSizeTB;
  const rawStorageTB = driveCount * driveSizeTB;

  return {
    raidLevel,
    usableStorageTB: round(usableStorageTB, 2),
    rawStorageTB: round(rawStorageTB, 2),
    driveSizeTB,
    driveCount,
    parityDrives,
    usableDrives,
  };
}

function calculatePoe(cameras: CameraSpec[]): PoeBudget {
  const byStandard = new Map<PoeStandard, { count: number; watts: number }>();

  for (const cam of cameras) {
    const std = cam.poeStandard || 'none';
    const watts = cam.poeWatts || 0;
    const existing = byStandard.get(std) ?? { count: 0, watts: 0 };
    existing.count += 1;
    existing.watts += watts;
    byStandard.set(std, existing);
  }

  const totalWatts = cameras.reduce((s, c) => s + (c.poeWatts || 0), 0);
  const recommendedSwitchWatts = Math.ceil(totalWatts * 1.25);

  return {
    totalWatts: round(totalWatts),
    cameraCount: cameras.length,
    byStandard: Array.from(byStandard.entries()).map(([standard, data]) => ({
      standard,
      count: data.count,
      watts: round(data.watts),
    })),
    recommendedSwitchWatts,
  };
}

function calculateTco(
  storageTB: number,
  cloudCostPerTBMonth: number,
  localCostPerTB: number,
): TcoAnalysis {
  const localNvrCost = storageTB * localCostPerTB;
  const cloudMonthlyCost = storageTB * cloudCostPerTBMonth;
  const cloud5YearCost = cloudMonthlyCost * 60;
  const localVsCloudSavings = cloud5YearCost - localNvrCost;

  return {
    localNvrCost: round(localNvrCost),
    cloudMonthlyCost: round(cloudMonthlyCost),
    cloud5YearCost: round(cloud5YearCost),
    localVsCloudSavings: round(localVsCloudSavings),
    recommendation: localVsCloudSavings > 0 ? 'Local NVR recommended — significant savings over 5 years' : 'Cloud storage may be cost-competitive for this deployment',
  };
}

// ---- Integrated Mode Helper ----

/**
 * Shape of a placed canvas device with optional joined library item data.
 */
export interface CanvasStorageDevice {
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
    poe_standard?: string | null;
  } | null;
}

/**
 * Convert placed canvas devices into CameraSpec[].
 *
 * Priority chain for each field:
 *   1. device.properties (user overrides on this specific placement)
 *   2. libraryItem / libraryItem.specs (manufacturer defaults from device library)
 *   3. undefined — user must provide via the UI
 *
 * Nothing is defaulted. If the data isn't there, the field stays undefined
 * and validateStorageInput() will flag it.
 *
 * Also accepts the old signature shape (without libraryItem) for backwards
 * compatibility — library fields will just be undefined.
 */
export function canvasDevicesToCameraSpecs(
  devices: (CanvasStorageDevice | { id: string; label: string; category: string; properties: Record<string, unknown> })[],
): CameraSpec[] {
  return devices
    .filter((d) => d.category === 'cctv')
    .map((d) => {
      const props = (d.properties ?? {}) as Record<string, unknown>;
      const lib = 'libraryItem' in d ? d.libraryItem : null;
      const libSpecs = ((lib?.specs ?? {}) as Record<string, unknown>);

      return {
        cameraId: d.id,
        label: d.label,
        resolutionLabel:
          (props.resolution as string) ||
          (lib?.resolution as string) ||
          undefined,
        resolutionW:
          (props.resolution_w as number) ||
          (libSpecs.resolution_w as number) ||
          undefined,
        resolutionH:
          (props.resolution_h as number) ||
          (libSpecs.resolution_h as number) ||
          undefined,
        fps:
          (props.fps as number) ||
          (lib?.fps ? parseInt(lib.fps, 10) : undefined) ||
          (libSpecs.fps as number) ||
          undefined,
        compression:
          ((props.compression as string) ||
          (libSpecs.compression as string) ||
          undefined) as Compression | undefined,
        smartCodec:
          props.smart_codec !== undefined ? (props.smart_codec as boolean) :
          libSpecs.smart_codec !== undefined ? (libSpecs.smart_codec as boolean) :
          undefined,
        motionPercent:
          (props.motion_percent as number) ||
          (libSpecs.motion_percent as number) ||
          undefined,
        poeStandard:
          ((props.poe_standard as string) ||
          (lib?.poe_standard as string) ||
          (libSpecs.poe_standard as string) ||
          undefined) as PoeStandard | undefined,
        poeWatts:
          (props.poe_watts as number) ||
          (lib?.wattage as number) ||
          (libSpecs.poe_watts as number) ||
          undefined,
      };
    });
}

function round(value: number, decimals: number = 1): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
