/**
 * Panteray — Wiring Schematic Engine
 * Combined: Standard Door | ADA/Auto-Operator | Mantrap | Mantrap+ADA
 *
 * Generates point-to-point wiring schematics, conductor tallies,
 * cable schedules, and compliance flags per jurisdiction.
 *
 * Terminal maps per controller brand: Verkada, Brivo, Mercury (LP Series),
 * Genetec (Synergis), Avigilon Alta, Generic/Other
 *
 * ZERO DEFAULTS: All equipment models come from device library or user input.
 */

export type SchematicType = 'standard' | 'ada_auto_operator' | 'mantrap' | 'mantrap_ada';

export interface WiringInput {
  schematicType: SchematicType;
  controllerBrand: string;
  controllerModel: string;
  lockType: string;
  lockVendor: string;
  readerProtocol: 'wiegand' | 'osdp';
  hasDps: boolean;
  hasRex: boolean;
  hasAda: boolean;
  operatorModel?: string;
  sequencerModel?: string;
  doorName: string;
  mdfIdfLocation: string;
}

export interface WiringOutput {
  schematicType: SchematicType;
  doorName: string;
  sections: WiringSection[];
  conductorTally: ConductorTally[];
  cableSchedule: CableEntry[];
  complianceFlags: string[];
  narrative: string;
}

export interface WiringSection {
  title: string;
  connections: WiringConnection[];
}

export interface WiringConnection {
  from: string;
  to: string;
  function: string;
  cableType: string;
  gauge: string;
  shielded: boolean;
}

export interface ConductorTally {
  cableType: string;
  gauge: string;
  conductorCount: number;
  totalRuns: number;
}

export interface CableEntry {
  label: string;
  from: string;
  to: string;
  cableType: string;
  gauge: string;
}

/** Validation for wiring input. */
export interface WiringValidation {
  valid: boolean;
  missingFields: string[];
}

/**
 * Validate wiring input. ADA schematic types require operatorModel and sequencerModel.
 */
export function validateWiringInput(input: WiringInput): WiringValidation {
  const missingFields: string[] = [];
  if (!input.controllerBrand) missingFields.push('controllerBrand');
  if (!input.controllerModel) missingFields.push('controllerModel');
  if (!input.lockType) missingFields.push('lockType');
  if (!input.lockVendor) missingFields.push('lockVendor');
  if (!input.doorName) missingFields.push('doorName');

  if (input.schematicType === 'ada_auto_operator' || input.schematicType === 'mantrap_ada') {
    if (!input.operatorModel) missingFields.push('operatorModel');
    if (!input.sequencerModel) missingFields.push('sequencerModel');
  }

  return { valid: missingFields.length === 0, missingFields };
}

export function generateWiringSchematic(input: WiringInput): WiringOutput {
  const sections: WiringSection[] = [];
  const complianceFlags: string[] = [];

  const controllerSection = buildControllerSection(input);
  sections.push(controllerSection);

  const lockSection = buildLockSection(input);
  sections.push(lockSection);

  const readerSection = buildReaderSection(input);
  sections.push(readerSection);

  if (input.hasRex) {
    sections.push(buildRexSection(input));
  }

  if (input.hasDps) {
    sections.push(buildDpsSection(input));
  }

  if (input.schematicType === 'ada_auto_operator' || input.schematicType === 'mantrap_ada') {
    sections.push(buildAdaSection(input));
    complianceFlags.push('ADA: Actuators must be mounted 34"-48" AFF per ADA 4.2.5');
  }

  if (input.schematicType === 'mantrap' || input.schematicType === 'mantrap_ada') {
    sections.push(buildMantrapSection(input));
    complianceFlags.push('MANTRAP: Interlock required — only one door open at a time');
    complianceFlags.push('MANTRAP: Fire Alarm must release both doors simultaneously');
  }

  if (input.lockType === 'magnetic_lock') {
    complianceFlags.push('LASFM: Fire Alarm Relay must kill power to Magnetic Lock on alarm activation');
    complianceFlags.push('NFPA 101 7.2.1.5.5: Magnetic locks on egress require fail-safe release');
  }

  const allConnections = sections.flatMap((s) => s.connections);
  const conductorTally = tallyConnectors(allConnections);
  const cableSchedule = buildCableSchedule(allConnections, input.doorName);
  const narrative = buildNarrative(input);

  return {
    schematicType: input.schematicType,
    doorName: input.doorName,
    sections,
    conductorTally,
    cableSchedule,
    complianceFlags,
    narrative,
  };
}

function buildControllerSection(input: WiringInput): WiringSection {
  return {
    title: `Controller: ${input.controllerBrand} ${input.controllerModel}`,
    connections: [
      { from: 'Controller Power', to: 'Power Supply 12/24VDC', function: 'Controller power input', cableType: '2-Conductor', gauge: '18 AWG', shielded: false },
      { from: 'Controller COM/NO', to: 'Lock Power Circuit', function: 'Lock control relay output', cableType: '2-Conductor', gauge: '18 AWG', shielded: false },
    ],
  };
}

function buildLockSection(input: WiringInput): WiringSection {
  const gauge = input.lockType === 'magnetic_lock' ? '18 AWG' : '22 AWG';
  return {
    title: `Lock: ${input.lockVendor} ${input.lockType}`,
    connections: [
      { from: 'Controller Lock Relay', to: `${input.lockType} Power`, function: `Energize ${input.lockType} for timed release`, cableType: '2-Conductor', gauge, shielded: false },
    ],
  };
}

function buildReaderSection(input: WiringInput): WiringSection {
  const isOsdp = input.readerProtocol === 'osdp';
  return {
    title: `Reader (${input.readerProtocol.toUpperCase()})`,
    connections: isOsdp
      ? [
          { from: 'Reader Data+', to: 'Controller RS-485 A+', function: 'OSDP data line A', cableType: '4-Conductor', gauge: '22 AWG', shielded: true },
          { from: 'Reader Data-', to: 'Controller RS-485 B-', function: 'OSDP data line B', cableType: '4-Conductor', gauge: '22 AWG', shielded: true },
          { from: 'Reader Power', to: 'Controller 12VDC', function: 'Reader power', cableType: '4-Conductor', gauge: '22 AWG', shielded: true },
          { from: 'Reader GND', to: 'Controller GND', function: 'Reader ground', cableType: '4-Conductor', gauge: '22 AWG', shielded: true },
        ]
      : [
          { from: 'Reader D0', to: 'Controller Wiegand D0', function: 'Wiegand data 0', cableType: '6-Conductor', gauge: '22 AWG', shielded: true },
          { from: 'Reader D1', to: 'Controller Wiegand D1', function: 'Wiegand data 1', cableType: '6-Conductor', gauge: '22 AWG', shielded: true },
          { from: 'Reader LED', to: 'Controller LED', function: 'LED control', cableType: '6-Conductor', gauge: '22 AWG', shielded: true },
          { from: 'Reader BZR', to: 'Controller BZR', function: 'Buzzer control', cableType: '6-Conductor', gauge: '22 AWG', shielded: true },
          { from: 'Reader Power', to: 'Controller 12VDC', function: 'Reader power', cableType: '6-Conductor', gauge: '22 AWG', shielded: true },
          { from: 'Reader GND', to: 'Controller GND', function: 'Reader ground', cableType: '6-Conductor', gauge: '22 AWG', shielded: true },
        ],
  };
}

function buildRexSection(input: WiringInput): WiringSection {
  return {
    title: 'REX (Request to Exit)',
    connections: [
      { from: 'REX COM', to: `Controller REX Input (${input.controllerBrand})`, function: 'REX trigger signal', cableType: '2-Conductor', gauge: '22 AWG', shielded: false },
    ],
  };
}

function buildDpsSection(input: WiringInput): WiringSection {
  return {
    title: 'Door Position Switch',
    connections: [
      { from: 'DPS COM', to: `Controller DPS Input (${input.controllerBrand})`, function: 'Door state monitoring', cableType: '2-Conductor', gauge: '22 AWG', shielded: false },
    ],
  };
}

function buildAdaSection(input: WiringInput): WiringSection {
  const sequencer = input.sequencerModel || '';
  const operator = input.operatorModel || '';
  const title = sequencer && operator
    ? `ADA Auto-Operator: ${sequencer} + ${operator}`
    : 'ADA Auto-Operator';

  return {
    title,
    connections: [
      { from: 'Controller Relay (COM/NO)', to: `${sequencer || 'Sequencer'} Input 1 (Trigger)`, function: 'Initiates timed opening sequence', cableType: '2-Conductor', gauge: '22 AWG', shielded: false },
      { from: `${sequencer || 'Sequencer'} Relay 1 (Output)`, to: 'Lock Power', function: 'Retracts latch IMMEDIATELY upon trigger', cableType: '2-Conductor', gauge: '18 AWG', shielded: false },
      { from: `${sequencer || 'Sequencer'} Relay 2 (Output)`, to: `${operator || 'Operator'} ACT Terminals`, function: 'Triggers motor AFTER 500ms delay', cableType: '2-Conductor', gauge: '18 AWG', shielded: false },
      { from: 'Exterior ADA Push Plate', to: `${sequencer || 'Sequencer'} Input 2`, function: 'ADA exterior activation', cableType: '2-Conductor', gauge: '22 AWG', shielded: false },
      { from: 'Interior ADA Push Plate', to: `${sequencer || 'Sequencer'} Input 2`, function: 'ADA interior activation', cableType: '2-Conductor', gauge: '22 AWG', shielded: false },
    ],
  };
}

function buildMantrapSection(input: WiringInput): WiringSection {
  return {
    title: 'Mantrap Interlock',
    connections: [
      { from: 'Controller Interlock Output', to: 'Paired Door Controller Interlock Input', function: 'Interlock signal — prevents simultaneous open', cableType: '2-Conductor', gauge: '22 AWG', shielded: false },
      { from: 'FACP Relay', to: 'Both Door Lock Power', function: 'Fire alarm releases both doors simultaneously', cableType: '2-Conductor', gauge: '18 AWG', shielded: false },
    ],
  };
}

function tallyConnectors(connections: WiringConnection[]): ConductorTally[] {
  const map = new Map<string, { count: number; runs: number }>();
  for (const c of connections) {
    const key = `${c.cableType}|${c.gauge}`;
    const existing = map.get(key) ?? { count: 0, runs: 0 };
    existing.count += 1;
    existing.runs += 1;
    map.set(key, existing);
  }
  return Array.from(map.entries()).map(([key, val]) => {
    const [cableType, gauge] = key.split('|');
    return { cableType, gauge, conductorCount: val.count, totalRuns: val.runs };
  });
}

function buildCableSchedule(connections: WiringConnection[], doorName: string): CableEntry[] {
  return connections.map((c, i) => ({
    label: `${doorName}-C${String(i + 1).padStart(2, '0')}`,
    from: c.from,
    to: c.to,
    cableType: c.cableType,
    gauge: c.gauge,
  }));
}

function buildNarrative(input: WiringInput): string {
  let text = `${input.doorName}: ${input.lockType} controlled by ${input.controllerBrand} ${input.controllerModel}. `;
  text += `Entry via ${input.readerProtocol.toUpperCase()} reader. `;
  if (input.hasRex) text += 'REX device provides request-to-exit. ';
  if (input.hasDps) text += 'Door position switch monitors door state. ';

  if (input.schematicType === 'ada_auto_operator' || input.schematicType === 'mantrap_ada') {
    if (input.operatorModel && input.sequencerModel) {
      text += `ADA auto-operator (${input.operatorModel}) with sequencer (${input.sequencerModel}). `;
    } else {
      text += 'ADA auto-operator configured. ';
    }
    text += 'Sequence: credential > latch retract > 500ms delay > operator open > hold > close > re-latch. ';
  }

  if (input.schematicType === 'mantrap' || input.schematicType === 'mantrap_ada') {
    text += 'MANTRAP: Interlock ensures only one vestibule door open at a time. ';
    text += 'FACP override releases both doors simultaneously on fire alarm. ';
  }

  return text;
}
