export interface GoogleSolarBuildingInsights {
  name?: string;
  imageryQuality?: string;
  solarPotential?: {
    maxSunshineHoursPerYear?: number;
    maxArrayPanelsCount?: number;
    panelCapacityWatts?: number;
  };
}

export interface GoogleSolarContext {
  resourceName: string | null;
  imageryQuality: string | null;
  annualSunshineHours: number | null;
  peakSunHours: number | null;
  maxArrayPanelsCount: number | null;
  panelCapacityWatts: number | null;
}

interface GoogleSolarLookupInput {
  latitude: number;
  longitude: number;
  requiredQuality?: "HIGH" | "MEDIUM" | "LOW" | "BASE";
  exactQualityRequired?: boolean;
}

const GOOGLE_SOLAR_BASE_URL = "https://solar.googleapis.com/v1/buildingInsights:findClosest";

export function derivePeakSunHoursFromAnnual(annualSunshineHours: number): number {
  if (!Number.isFinite(annualSunshineHours) || annualSunshineHours <= 0) return 0;
  return round(annualSunshineHours / 365, 2);
}

export function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function mapBuildingInsightsToSolarContext(
  insights: GoogleSolarBuildingInsights
): GoogleSolarContext {
  const annualSunshineHours = toFiniteNumber(insights.solarPotential?.maxSunshineHoursPerYear);

  return {
    resourceName: insights.name ?? null,
    imageryQuality: insights.imageryQuality ?? null,
    annualSunshineHours,
    peakSunHours: annualSunshineHours ? derivePeakSunHoursFromAnnual(annualSunshineHours) : null,
    maxArrayPanelsCount: toFiniteNumber(insights.solarPotential?.maxArrayPanelsCount),
    panelCapacityWatts: toFiniteNumber(insights.solarPotential?.panelCapacityWatts),
  };
}

export async function fetchGoogleSolarBuildingInsights(
  input: GoogleSolarLookupInput
): Promise<GoogleSolarContext> {
  const key = getGoogleSolarApiKey();
  if (!key) {
    throw new Error("Google Solar API key not configured.");
  }

  const params = new URLSearchParams({
    "location.latitude": String(input.latitude),
    "location.longitude": String(input.longitude),
    requiredQuality: input.requiredQuality ?? "MEDIUM",
  });

  if (typeof input.exactQualityRequired === "boolean") {
    params.set("exactQualityRequired", String(input.exactQualityRequired));
  }

  params.set("key", key);

  const res = await fetch(`${GOOGLE_SOLAR_BASE_URL}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Google Solar API error (${res.status}).`);
  }

  const payload = (await res.json()) as GoogleSolarBuildingInsights;
  return mapBuildingInsightsToSolarContext(payload);
}

function getGoogleSolarApiKey(): string | null {
  const key = process.env.GOOGLE_MAPS_STATIC_KEY;
  if (!key || key === "PLACEHOLDER") return null;
  return key;
}

function round(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
