/**
 * Panteray — Wireless PtP Calculator Engine
 *
 * Link budget, Fresnel zone, rain fade, wind load calculations
 * for point-to-point wireless bridge deployments.
 *
 * ZERO DEFAULTS:
 * - Equipment specs (radio power, antenna gain, sensitivity) come from device library only.
 * - Site conditions (wind speed, antenna area, camera count, bandwidth) come from user input only.
 * - If any required field is missing, the engine will not run — the UI
 *   prompts the user to fill in what's missing via validateWirelessInput().
 */

export interface WirelessPtpInput {
  radioVendor: string;
  radioModel: string;
  mode: 'ptp' | 'ptmp';
  distanceMiles: number;
  frequencyGHz: number;
  txPowerDbm: number;
  antennaGainDbi: number;
  rxSensitivityDbm: number;
  antennaHeightAFt: number;
  antennaHeightBFt: number;
  rainRateMmHr: number;
  camerasPerSite: number;
  bandwidthPerCameraMbps: number;
  maxThroughputMbps: number;
  windSpeedMph: number;
  antennaSurfaceAreaSqFt: number;
  poeWattsPerCamera: number;
  radioWatts: number;
}

export interface WirelessPtpOutput {
  freeSpaceLossDb: number;
  rainFadeDb: number;
  totalPathLossDb: number;
  linkBudgetDb: number;
  fadeMarginDb: number;
  fadeMarginStatus: 'pass' | 'warning' | 'fail';
  fresnelZoneRadiusFt: number;
  fresnelClearanceStatus: 'pass' | 'warning' | 'fail';
  requiredBandwidthMbps: number;
  linkUtilizationPct: number;
  linkUtilizationStatus: 'pass' | 'warning' | 'fail';
  windLoadLbs: number;
  remoteSitePoeWatts: number;
  recommendedSwitch: string;
  warnings: string[];
}

/**
 * Partial input for canvas bridge — all fields optional.
 */
export type WirelessPtpInputPartial = {
  [K in keyof WirelessPtpInput]?: WirelessPtpInput[K];
};

/** All required fields. */
const REQUIRED_FIELDS: (keyof WirelessPtpInput)[] = [
  'radioVendor',
  'radioModel',
  'mode',
  'distanceMiles',
  'frequencyGHz',
  'txPowerDbm',
  'antennaGainDbi',
  'rxSensitivityDbm',
  'antennaHeightAFt',
  'antennaHeightBFt',
  'rainRateMmHr',
  'camerasPerSite',
  'bandwidthPerCameraMbps',
  'maxThroughputMbps',
  'windSpeedMph',
  'antennaSurfaceAreaSqFt',
  'poeWattsPerCamera',
  'radioWatts',
];

export interface WirelessValidation {
  valid: boolean;
  missingFields: string[];
}

/**
 * Check if a partial wireless input has all required fields.
 */
export function validateWirelessInput(partial: WirelessPtpInputPartial): WirelessValidation {
  const missingFields: string[] = [];
  for (const field of REQUIRED_FIELDS) {
    const val = partial[field];
    if (val === undefined || val === null || val === '') {
      missingFields.push(field);
    }
  }
  return { valid: missingFields.length === 0, missingFields };
}

const SPEED_OF_LIGHT = 299792458;

export function calculateWirelessPtp(input: WirelessPtpInput): WirelessPtpOutput {
  const {
    distanceMiles, frequencyGHz, txPowerDbm, antennaGainDbi, rxSensitivityDbm,
    antennaHeightAFt, antennaHeightBFt, rainRateMmHr,
    camerasPerSite, bandwidthPerCameraMbps, maxThroughputMbps,
    windSpeedMph, antennaSurfaceAreaSqFt, poeWattsPerCamera, radioWatts,
  } = input;
  const warnings: string[] = [];

  const distanceKm = distanceMiles * 1.60934;
  const distanceM = distanceKm * 1000;
  const frequencyHz = frequencyGHz * 1e9;

  const freeSpaceLossDb = round(20 * Math.log10(distanceM) + 20 * Math.log10(frequencyHz) - 147.55);

  let rainAttenuationPerKm = 0;
  if (rainRateMmHr > 0) {
    const k = frequencyGHz > 10 ? 0.01 : 0.001;
    const alpha = frequencyGHz > 10 ? 1.2 : 0.9;
    rainAttenuationPerKm = k * Math.pow(rainRateMmHr, alpha);
  }
  const rainFadeDb = round(rainAttenuationPerKm * distanceKm);

  const totalPathLossDb = round(freeSpaceLossDb + rainFadeDb);
  const linkBudgetDb = round(txPowerDbm + antennaGainDbi * 2 - totalPathLossDb);
  const fadeMarginDb = round(linkBudgetDb - rxSensitivityDbm);

  let fadeMarginStatus: 'pass' | 'warning' | 'fail' = 'pass';
  if (fadeMarginDb < 10) { fadeMarginStatus = 'fail'; warnings.push(`Fade margin ${fadeMarginDb} dB below 10 dB minimum.`); }
  else if (fadeMarginDb < 20) { fadeMarginStatus = 'warning'; warnings.push(`Fade margin ${fadeMarginDb} dB — acceptable but consider higher gain antennas.`); }

  const fresnelRadiusM = 17.32 * Math.sqrt((distanceKm * 0.5) / (frequencyGHz * distanceKm));
  const fresnelZoneRadiusFt = round(fresnelRadiusM * 3.28084);
  const minClearanceFt = fresnelZoneRadiusFt * 0.6;
  const midpointHeightFt = (antennaHeightAFt + antennaHeightBFt) / 2;

  let fresnelClearanceStatus: 'pass' | 'warning' | 'fail' = 'pass';
  if (midpointHeightFt < minClearanceFt) { fresnelClearanceStatus = 'fail'; warnings.push(`Fresnel zone clearance insufficient. Need ${round(minClearanceFt)} ft, midpoint is ${round(midpointHeightFt)} ft.`); }
  else if (midpointHeightFt < fresnelZoneRadiusFt) { fresnelClearanceStatus = 'warning'; }

  const requiredBandwidthMbps = round(camerasPerSite * bandwidthPerCameraMbps);
  const linkUtilizationPct = round((requiredBandwidthMbps / maxThroughputMbps) * 100);
  let linkUtilizationStatus: 'pass' | 'warning' | 'fail' = 'pass';
  if (linkUtilizationPct > 80) { linkUtilizationStatus = 'fail'; warnings.push(`Link utilization ${linkUtilizationPct}% exceeds 80%. Reduce cameras or upgrade radio.`); }
  else if (linkUtilizationPct > 60) { linkUtilizationStatus = 'warning'; }

  const windLoadLbs = round(0.00256 * windSpeedMph * windSpeedMph * antennaSurfaceAreaSqFt * 1.2);

  const remoteSitePoeWatts = round(camerasPerSite * poeWattsPerCamera + radioWatts);
  let recommendedSwitch = 'Unmanaged PoE switch (4-port)';
  if (camerasPerSite > 8) recommendedSwitch = 'Managed PoE switch (16-port)';
  else if (camerasPerSite > 4) recommendedSwitch = 'Managed PoE switch (8-port)';

  return {
    freeSpaceLossDb, rainFadeDb, totalPathLossDb, linkBudgetDb, fadeMarginDb, fadeMarginStatus,
    fresnelZoneRadiusFt, fresnelClearanceStatus,
    requiredBandwidthMbps, linkUtilizationPct, linkUtilizationStatus,
    windLoadLbs, remoteSitePoeWatts, recommendedSwitch, warnings,
  };
}

function round(v: number, d: number = 1): number { const f = Math.pow(10, d); return Math.round(v * f) / f; }
