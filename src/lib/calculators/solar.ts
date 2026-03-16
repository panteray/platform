/**
 * Panteray — Solar Calculator Engine
 *
 * Sizes solar power systems for remote camera installations.
 * Calculates panel wattage, battery capacity, and enclosure needs.
 */

export interface SolarInput {
  cameraWatts: number;
  systemVoltage: 12 | 24;
  autonomyDays: number;
  peakSunHours: number;
  latitude?: number;
}

export interface SolarOutput {
  dailyLoadWh: number;
  requiredPanelWatts: number;
  batteryCapacityAh: number;
  recommendedBatteryAh: number;
  batteryType: string;
  nemaEnclosureSize: string;
  poeInjector: string;
  panelCount: number;
  panelWatts: number;
  warnings: string[];
}

const STANDARD_BATTERY_SIZES = [20, 30, 50, 75, 100, 150, 200, 300];
const PANEL_SIZES = [100, 200, 300, 400, 500];

export function calculateSolar(input: SolarInput): SolarOutput {
  const { cameraWatts, systemVoltage, autonomyDays, peakSunHours } = input;
  const warnings: string[] = [];

  const dailyLoadWh = cameraWatts * 24;
  const totalEnergyWh = dailyLoadWh * autonomyDays;
  const batteryCapacityAh = totalEnergyWh / systemVoltage / 0.5;
  const recommendedBatteryAh = STANDARD_BATTERY_SIZES.find((s) => s >= batteryCapacityAh) ?? Math.ceil(batteryCapacityAh);

  const systemEfficiency = 0.85;
  const requiredPanelWatts = Math.ceil((dailyLoadWh / peakSunHours) / systemEfficiency);
  const panelWatts = PANEL_SIZES.find((s) => s >= requiredPanelWatts) ?? Math.ceil(requiredPanelWatts / 100) * 100;
  const panelCount = Math.ceil(requiredPanelWatts / panelWatts) || 1;

  let nemaEnclosureSize = 'NEMA 4X - 24x24x10';
  if (recommendedBatteryAh > 200) nemaEnclosureSize = 'NEMA 4X - 36x36x12';
  else if (recommendedBatteryAh > 100) nemaEnclosureSize = 'NEMA 4X - 30x30x12';

  const poeInjector = cameraWatts > 25 ? 'PoE++ (802.3bt) injector required' : cameraWatts > 12.95 ? 'PoE+ (802.3at) injector required' : 'Standard PoE (802.3af) injector';

  if (peakSunHours < 3) warnings.push('Low sun hours — consider larger panel or additional battery capacity.');
  if (autonomyDays < 2) warnings.push('Less than 2 days autonomy — risk of outage during extended cloudy periods.');
  if (cameraWatts > 60) warnings.push('High power draw — verify solar panel and battery sizing with site survey.');

  return {
    dailyLoadWh: round(dailyLoadWh),
    requiredPanelWatts,
    batteryCapacityAh: round(batteryCapacityAh),
    recommendedBatteryAh,
    batteryType: 'LiFePO4',
    nemaEnclosureSize,
    poeInjector,
    panelCount,
    panelWatts,
    warnings,
  };
}

function round(v: number, d: number = 1): number { const f = Math.pow(10, d); return Math.round(v * f) / f; }
