/**
 * Panteray — Cable Estimator Engine
 * Priority 2 build — feeds cable footage running totals to Design Dashboard
 *
 * Integrated mode: reads from canvas polylines + MDF/IDF assignments
 * Standalone mode: manual input per run
 * Cable overage → SoftFlagEvent only (NO auto-CO per Golden Rule #1)
 */

export interface CableTypeDefinition {
  type: string;
  color: string;
  conductorCount?: number;
  gauge?: string;
  maxLengthFt: number;
  voltageDropPerFt?: number;
  costPerFt?: number;
  reelSizeFt: number;
}

export const CABLE_TYPES: CableTypeDefinition[] = [
  { type: 'Cat6',        color: '#3b82f6', maxLengthFt: 328, reelSizeFt: 1000 },
  { type: 'Composite',   color: '#eab308', maxLengthFt: 500, reelSizeFt: 1000 },
  { type: '2-Conductor', color: '#6b7280', conductorCount: 2, gauge: '18 AWG', maxLengthFt: 500, voltageDropPerFt: 0.0064, reelSizeFt: 1000 },
  { type: '4-Conductor', color: '#8b5cf6', conductorCount: 4, gauge: '22 AWG', maxLengthFt: 500, voltageDropPerFt: 0.016, reelSizeFt: 500 },
  { type: 'HDMI',        color: '#ef4444', maxLengthFt: 50, reelSizeFt: 0 },
  { type: 'Fiber SM',    color: '#22c55e', maxLengthFt: 10000, reelSizeFt: 1000 },
  { type: 'Fiber MM',    color: '#f59e0b', maxLengthFt: 1000, reelSizeFt: 1000 },
  { type: 'Other',       color: '#6b7280', maxLengthFt: 1000, reelSizeFt: 1000 },
];

export interface CableRun {
  runId: string;
  cableType: string;
  label: string;
  horizontalDistanceFt: number;
  verticalDropFt: number;
  slackPercent: number;
  fromDevice?: string;
  toDevice?: string;
  mdfIdf?: string;
  supplyVoltage?: number;
  loadAmps?: number;
}

export interface CableEstimatorInput {
  runs: CableRun[];
  serviceLoopFt: number;
}

export interface VoltageDropResult {
  supplyVoltage: number;
  voltageDrop: number;
  voltageAtDevice: number;
  dropPercent: number;
  status: 'pass' | 'warning' | 'fail';
}

export interface CableRunResult {
  runId: string;
  label: string;
  cableType: string;
  horizontalFt: number;
  verticalFt: number;
  slackFt: number;
  serviceLoopFt: number;
  estimatedTotalFt: number;
  voltageDrop: VoltageDropResult | null;
  warnings: string[];
}

export interface CableTypeSummary {
  cableType: string;
  color: string;
  totalFootage: number;
  runCount: number;
  bulkReelsNeeded: number;
  reelSizeFt: number;
  estimatedWaste: number;
}

export interface CableSoftFlag {
  type: 'cable_overage' | 'max_length_exceeded' | 'voltage_drop_fail' | 'unknown_cable_type';
  runId: string;
  label: string;
  message: string;
}

export interface CableEstimatorOutput {
  runs: CableRunResult[];
  summaryByType: CableTypeSummary[];
  grandTotalFootage: number;
  totalRuns: number;
  summaryByMdfIdf: { mdfIdf: string; totalFootage: number; runCount: number }[];
  softFlags: CableSoftFlag[];
}

// ─── Canvas integration bridge ────────────────────────────────────────

export interface CanvasCablePolyline {
  polylineId: string;
  cableType: string;
  fromDeviceLabel: string;
  toDeviceLabel: string;
  mdfIdf: string;
  measuredLengthFt: number;
  verticalDropFt: number;
  slackPercent: number;
  customColor?: string;
  supplyVoltage?: number;
  loadAmps?: number;
}

/**
 * Convert canvas cable polyline data into CableEstimatorInput.
 * This is the bridge between the design canvas and the cable estimator engine.
 */
export function canvasPolylinesToInput(polylines: CanvasCablePolyline[], defaultServiceLoopFt = 10): CableEstimatorInput {
  return {
    runs: polylines.map((p) => ({
      runId: p.polylineId,
      cableType: p.cableType,
      label: `${p.fromDeviceLabel} to ${p.toDeviceLabel}`,
      horizontalDistanceFt: p.measuredLengthFt,
      verticalDropFt: p.verticalDropFt,
      slackPercent: p.slackPercent,
      fromDevice: p.fromDeviceLabel,
      toDevice: p.toDeviceLabel,
      mdfIdf: p.mdfIdf,
      supplyVoltage: p.supplyVoltage,
      loadAmps: p.loadAmps,
    })),
    serviceLoopFt: defaultServiceLoopFt,
  };
}

// ─── Engine ───────────────────────────────────────────────────────────

export function runCableEstimator(input: CableEstimatorInput): CableEstimatorOutput {
  if (!input.runs.length) return emptyOutput();

  const cableTypeMap = new Map(CABLE_TYPES.map((ct) => [ct.type, ct]));
  const softFlags: CableSoftFlag[] = [];

  const runs: CableRunResult[] = input.runs.map((run) => {
    const cableDef = cableTypeMap.get(run.cableType);
    const warnings: string[] = [];

    if (!cableDef) {
      warnings.push(`Unknown cable type '${run.cableType}' - using fallback assumptions.`);
      softFlags.push({
        type: 'unknown_cable_type',
        runId: run.runId,
        label: run.label,
        message: `Unknown cable type '${run.cableType}' - verify cable catalog entry.`,
      });
    }

    const horizontal = Math.max(0, run.horizontalDistanceFt);
    const vertical = Math.max(0, run.verticalDropFt);
    const slackFt = (horizontal + vertical) * (Math.max(0, run.slackPercent) / 100);
    const estimatedTotalFt = horizontal + vertical + slackFt + Math.max(0, input.serviceLoopFt);

    if (cableDef && estimatedTotalFt > cableDef.maxLengthFt) {
      warnings.push(`Run exceeds max recommended length for ${run.cableType}: ${round(estimatedTotalFt)} ft vs ${cableDef.maxLengthFt} ft limit`);
      softFlags.push({
        type: 'max_length_exceeded',
        runId: run.runId,
        label: run.label,
        message: `${run.cableType} run ${run.label}: ${round(estimatedTotalFt)} ft exceeds ${cableDef.maxLengthFt} ft max`,
      });
    }

    let voltageDrop: VoltageDropResult | null = null;
    if (cableDef?.voltageDropPerFt != null && run.supplyVoltage != null && run.loadAmps != null) {
      const vDrop = cableDef.voltageDropPerFt * estimatedTotalFt * run.loadAmps * 2;
      const voltageAtDevice = run.supplyVoltage - vDrop;
      const dropPercent = (vDrop / run.supplyVoltage) * 100;
      let status: VoltageDropResult['status'] = 'pass';

      if (dropPercent > 10) {
        status = 'fail';
        warnings.push(`Voltage drop exceeds 10%: ${round(dropPercent)}% drop over ${round(estimatedTotalFt)} ft.`);
        softFlags.push({ type: 'voltage_drop_fail', runId: run.runId, label: run.label, message: `${run.label}: ${round(dropPercent)}% voltage drop (${round(voltageAtDevice)}V at device)` });
      } else if (dropPercent > 5) {
        status = 'warning';
        warnings.push(`Voltage drop warning: ${round(dropPercent)}% over ${round(estimatedTotalFt)} ft.`);
      }

      voltageDrop = { supplyVoltage: run.supplyVoltage, voltageDrop: round(vDrop), voltageAtDevice: round(voltageAtDevice), dropPercent: round(dropPercent), status };
    }

    return { runId: run.runId, label: run.label, cableType: run.cableType, horizontalFt: round(horizontal), verticalFt: round(vertical), slackFt: round(slackFt), serviceLoopFt: round(input.serviceLoopFt), estimatedTotalFt: round(estimatedTotalFt), voltageDrop, warnings };
  });

  const typeAgg = new Map<string, { totalFt: number; count: number }>();
  for (const run of runs) {
    const existing = typeAgg.get(run.cableType) ?? { totalFt: 0, count: 0 };
    existing.totalFt += run.estimatedTotalFt;
    existing.count += 1;
    typeAgg.set(run.cableType, existing);
  }

  const summaryByType: CableTypeSummary[] = Array.from(typeAgg.entries()).map(([type, agg]) => {
    const cableDef = cableTypeMap.get(type);
    const reelSize = cableDef?.reelSizeFt ?? 1000;
    const reels = reelSize > 0 ? Math.ceil(agg.totalFt / reelSize) : 0;
    return { cableType: type, color: cableDef?.color ?? '#6b7280', totalFootage: round(agg.totalFt), runCount: agg.count, bulkReelsNeeded: reels, reelSizeFt: reelSize, estimatedWaste: round(reels * reelSize - agg.totalFt) };
  });

  const mdfAgg = new Map<string, { totalFt: number; count: number }>();
  for (let i = 0; i < input.runs.length; i++) {
    const mdf = input.runs[i].mdfIdf ?? 'Unassigned';
    const existing = mdfAgg.get(mdf) ?? { totalFt: 0, count: 0 };
    existing.totalFt += runs[i].estimatedTotalFt;
    existing.count += 1;
    mdfAgg.set(mdf, existing);
  }

  const summaryByMdfIdf = Array.from(mdfAgg.entries()).map(([mdfIdf, agg]) => ({ mdfIdf, totalFootage: round(agg.totalFt), runCount: agg.count }));
  const grandTotalFootage = runs.reduce((sum, r) => sum + r.estimatedTotalFt, 0);

  return { runs, summaryByType, grandTotalFootage: round(grandTotalFootage), totalRuns: runs.length, summaryByMdfIdf, softFlags };
}

// ─── Overage check (field install phase) ──────────────────────────────

export function checkCableOverage(estimatedTotalFt: number, actualLengthPulled: number, runLabel: string, runId: string): CableSoftFlag | null {
  if (estimatedTotalFt <= 0) return null;
  const threshold = estimatedTotalFt * 1.15;
  if (actualLengthPulled > threshold) {
    const overage = actualLengthPulled - estimatedTotalFt;
    const overagePct = (overage / estimatedTotalFt) * 100;
    return { type: 'cable_overage', runId, label: runLabel, message: `Cable overage on ${runLabel}: actual ${round(actualLengthPulled)} ft vs estimated ${round(estimatedTotalFt)} ft (+${round(overagePct)}%). PM review recommended.` };
  }
  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function round(value: number, decimals: number = 1): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function emptyOutput(): CableEstimatorOutput {
  return { runs: [], summaryByType: [], grandTotalFootage: 0, totalRuns: 0, summaryByMdfIdf: [], softFlags: [] };
}
