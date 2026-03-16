/**
 * ACS (Access Control System) build engine — door/lock compliance and wiring.
 * Used by DoorCompliancePanel for electrical load and compliance notes.
 */

export type LockType = "maglock" | "electric_strike" | "mortise" | "other";
export type DoorType = "single" | "double" | "mantrap";

export interface AcsBuildInput {
  doorType: DoorType;
  lockType: LockType;
  controllerDrawAmps: number;
  lockDrawAmps: number;
  hasAdo?: boolean;
  isMantrap?: boolean;
}

export interface WiringSpec {
  type: string;
  gauge: string;
  cond: number;
}

export interface AcsBuildOutput {
  compliance: {
    violations: string[];
    notes: string[];
  };
  electrical: {
    totalDrawAmps: number;
    minPsuAmps: number;
  };
  wiringSchedule: Record<string, WiringSpec>;
}

const TYPICAL_PSU_HEADROOM = 1.2;

export function runAcsEngine(input: AcsBuildInput): AcsBuildOutput {
  const violations: string[] = [];
  const notes: string[] = [];
  const totalDrawAmps =
    (input.controllerDrawAmps ?? 0.5) + (input.lockDrawAmps ?? 0.3);
  const minPsuAmps = Math.ceil(totalDrawAmps * TYPICAL_PSU_HEADROOM * 10) / 10;

  if (input.isMantrap && input.lockType === "maglock") {
    notes.push("Mantrap with maglock: ensure fail-secure/fail-safe coordination.");
  }
  if (input.lockType === "maglock" && (input.controllerDrawAmps ?? 0) + (input.lockDrawAmps ?? 0) > 1) {
    notes.push("High-draw maglock: verify PSU and cable gauge.");
  }
  if (input.hasAdo) {
    notes.push("ADO present: include in total load and wiring.");
  }

  const wiringSchedule: Record<string, WiringSpec> = {
    "Lock power": { type: "2-conductor", gauge: "18 AWG", cond: 2 },
    "Reader/data": { type: "4-pair", gauge: "24 AWG", cond: 8 },
  };
  if (input.controllerDrawAmps > 0.5 || input.lockDrawAmps > 0.5) {
    wiringSchedule["Lock power"] = { type: "2-conductor", gauge: "16 AWG", cond: 2 };
  }

  return {
    compliance: { violations, notes },
    electrical: { totalDrawAmps, minPsuAmps },
    wiringSchedule,
  };
}
