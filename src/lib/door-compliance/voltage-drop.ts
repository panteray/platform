// Voltage drop utility for ACS cable runs.
// Formula: V_drop = (2 * Length * Resistance_per_1000ft * Current_Amps) / 1000
// DC resistance per 1000 ft (Ohms) for common security/ACS cables.

export const WIRE_RESISTANCE: Record<string, number> = {
  "22/2": 16.14,  // 22 AWG
  "22/4": 16.14,
  "22/6": 16.14,
  "18/2": 6.385,  // 18 AWG
  "18/4": 6.385,
  "18/6": 6.385,
  "16/2": 4.016,  // 16 AWG
  "14/2": 2.525,  // 14 AWG
  "24/4": 25.67,  // 24 AWG
  "cat5e": 28.6,
  "cat6": 23.6,
}

export interface VoltageDropResult {
  voltageAtDevice: number
  voltageDrop: number
  percentageDrop: number
  isCompliant: boolean
  wireGauge: string
}

/**
 * Calculates the voltage drop across a cable run.
 * Compliance threshold: 10% max drop for 12V/24V ACS circuits.
 */
export function calculateVoltageDrop(
  supplyVoltage: number,
  cableType: string,
  lengthFt: number,
  drawAmps: number
): VoltageDropResult {
  const resistancePer1000 =
    WIRE_RESISTANCE[cableType] ??
    WIRE_RESISTANCE[cableType.toLowerCase()] ??
    WIRE_RESISTANCE["18/2"]

  const voltageDrop = (2 * lengthFt * resistancePer1000 * drawAmps) / 1000
  const voltageAtDevice = supplyVoltage - voltageDrop
  const percentageDrop = supplyVoltage > 0 ? (voltageDrop / supplyVoltage) * 100 : 0
  const isCompliant = percentageDrop <= 10

  return {
    voltageAtDevice: Number(voltageAtDevice.toFixed(2)),
    voltageDrop: Number(voltageDrop.toFixed(2)),
    percentageDrop: Number(percentageDrop.toFixed(2)),
    isCompliant,
    wireGauge: cableType,
  }
}
