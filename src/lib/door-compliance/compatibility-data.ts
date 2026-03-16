export type DoorType = "single" | "double" | "storefront" | "hollow_metal" | "wood";
export type FireRated = boolean;
export type ElectrificationType = "electrified_trim" | "electric_latch_retraction" | "surface_maglock" | "delayed_egress";
export type OccupancyType = "assembly" | "business" | "educational" | "healthcare" | "institutional" | "mercantile" | "residential" | "storage" | "utility";

export interface PanicHardwareConfig {
  id: string;
  name: string;
  electrificationType: ElectrificationType;
  compatibleDoorTypes: DoorType[];
  fireRatedCompatible: boolean;
  occupancyRestrictions?: OccupancyType[];
  priority: number;
  codeReferences: string[];
  notes?: string;
}

export interface CompatibilityResult {
  compatible: boolean;
  recommended: boolean;
  flags: CompatibilityFlag[];
  advisoryNotes: string[];
  codeReferences: string[];
}

export interface CompatibilityFlag {
  level: "compliant" | "warning" | "critical" | "advisory";
  message: string;
  codeRef?: string;
}

export const DOOR_TYPE_LABELS: Record<DoorType, string> = {
  single: "Single Door",
  double: "Double Door (Pair)",
  storefront: "Storefront",
  hollow_metal: "Hollow Metal",
  wood: "Wood",
};

export const ELECTRIFICATION_LABELS: Record<ElectrificationType, string> = {
  electrified_trim: "Electrified Trim",
  electric_latch_retraction: "Electric Latch Retraction (ELR)",
  surface_maglock: "Surface Mounted Maglock",
  delayed_egress: "Delayed Egress Device",
};

export const OCCUPANCY_LABELS: Record<OccupancyType, string> = {
  assembly: "Assembly (A)",
  business: "Business (B)",
  educational: "Educational (E)",
  healthcare: "Healthcare (I-2)",
  institutional: "Institutional (I-3)",
  mercantile: "Mercantile (M)",
  residential: "Residential (R)",
  storage: "Storage (S)",
  utility: "Utility (U)",
};

export const PANIC_HARDWARE_CONFIGS: PanicHardwareConfig[] = [
  {
    id: "elr-rim",
    name: "Electric Latch Retraction – Rim Exit Device",
    electrificationType: "electric_latch_retraction",
    compatibleDoorTypes: ["single", "double", "hollow_metal", "wood"],
    fireRatedCompatible: true,
    priority: 1,
    codeReferences: ["IBC 1010.1.10", "NFPA 101 7.2.1.5.5", "UL 305"],
  },
  {
    id: "elr-mortise",
    name: "Electric Latch Retraction – Mortise Exit Device",
    electrificationType: "electric_latch_retraction",
    compatibleDoorTypes: ["single", "double", "hollow_metal"],
    fireRatedCompatible: true,
    priority: 1,
    codeReferences: ["IBC 1010.1.10", "NFPA 101 7.2.1.5.5", "UL 305"],
  },
  {
    id: "et-rim",
    name: "Electrified Trim – Rim Exit Device",
    electrificationType: "electrified_trim",
    compatibleDoorTypes: ["single", "double", "hollow_metal", "wood"],
    fireRatedCompatible: true,
    priority: 2,
    codeReferences: ["IBC 1010.1.10", "NFPA 101 7.2.1.5.5"],
  },
  {
    id: "et-cvr",
    name: "Electrified Trim – CVR Exit Device",
    electrificationType: "electrified_trim",
    compatibleDoorTypes: ["single", "double", "hollow_metal"],
    fireRatedCompatible: true,
    priority: 2,
    codeReferences: ["IBC 1010.1.10", "NFPA 101 7.2.1.5.5"],
  },
  {
    id: "maglock-surface",
    name: "Surface Mounted Electromagnetic Lock",
    electrificationType: "surface_maglock",
    compatibleDoorTypes: ["single", "double", "storefront", "hollow_metal", "wood"],
    fireRatedCompatible: false,
    priority: 4,
    codeReferences: ["IBC 1010.1.9.9", "NFPA 101 7.2.1.5.5", "NFPA 72"],
    notes: "Requires listed releasing device, motion sensor REX, and fire alarm tie-in where required.",
  },
  {
    id: "delayed-egress",
    name: "Delayed Egress Lock",
    electrificationType: "delayed_egress",
    compatibleDoorTypes: ["single", "double", "hollow_metal"],
    fireRatedCompatible: true,
    occupancyRestrictions: ["assembly", "educational", "healthcare", "institutional"],
    priority: 3,
    codeReferences: ["IBC 1010.1.9.8", "NFPA 101 7.2.1.6.1"],
    notes: "15/30 second delay. Must release on fire alarm, sprinkler, or power loss.",
  },
];

export function evaluateCompatibility(
  doorType: DoorType,
  fireRated: boolean,
  electrificationType: ElectrificationType,
  occupancyType: OccupancyType,
  jurisdictionLASFM: boolean
): CompatibilityResult {
  const flags: CompatibilityFlag[] = [];
  const advisoryNotes: string[] = [];
  const codeReferences: string[] = [];

  const config = PANIC_HARDWARE_CONFIGS.find(
    (c) => c.electrificationType === electrificationType && c.compatibleDoorTypes.includes(doorType)
  );

  if (!config) {
    flags.push({
      level: "critical",
      message: `${ELECTRIFICATION_LABELS[electrificationType]} is not compatible with ${DOOR_TYPE_LABELS[doorType]}.`,
    });
    return { compatible: false, recommended: false, flags, advisoryNotes, codeReferences };
  }

  codeReferences.push(...config.codeReferences);

  if (fireRated && !config.fireRatedCompatible) {
    flags.push({
      level: "critical",
      message: "Surface maglock on fire-rated egress door violates fire code. Electrified panic hardware is required.",
      codeRef: "IBC 716.2, NFPA 80",
    });
    codeReferences.push("IBC 716.2", "NFPA 80");
  }

  if (electrificationType === "surface_maglock") {
    flags.push({
      level: "warning",
      message: "Maglock selected. Electrified panic hardware should be evaluated first.",
      codeRef: "IBC 1010.1.9.9",
    });
    advisoryNotes.push("Maglock requires: listed releasing device, motion sensor REX, fire alarm tie-in (if required by AHJ).");
    advisoryNotes.push("Maglock Justification required – explain why electrified hardware is not feasible.");

    if (fireRated) {
      flags.push({
        level: "critical",
        message: "Surface maglock is NOT permitted on fire-rated egress doors. Use electrified panic hardware.",
        codeRef: "NFPA 80 6.4.4",
      });
    }
  }

  if (config.occupancyRestrictions && config.occupancyRestrictions.includes(occupancyType)) {
    flags.push({
      level: "warning",
      message: `${config.name} has restrictions for ${OCCUPANCY_LABELS[occupancyType]} occupancy. Verify with AHJ.`,
    });
  }

  if (electrificationType === "delayed_egress" && occupancyType === "assembly") {
    flags.push({
      level: "critical",
      message: "Delayed egress is generally prohibited in Assembly occupancy.",
      codeRef: "IBC 1010.1.9.8",
    });
  }

  if (jurisdictionLASFM) {
    advisoryNotes.push("LASFM jurisdiction enabled – additional local fire marshal requirements may apply.");
    codeReferences.push("LASFM Title 19");
  }

  const betterOptions = PANIC_HARDWARE_CONFIGS.filter(
    (c) =>
      c.compatibleDoorTypes.includes(doorType) &&
      c.priority < (config?.priority ?? 99) &&
      (!fireRated || c.fireRatedCompatible)
  );
  if (betterOptions.length > 0 && electrificationType === "surface_maglock") {
    flags.push({
      level: "advisory",
      message: `Recommended alternatives: ${betterOptions.map((o) => o.name).join(", ")}`,
    });
  }

  advisoryNotes.push("Advisory – Final determination by AHJ.");

  const hasCritical = flags.some((f) => f.level === "critical");

  return {
    compatible: !hasCritical,
    recommended: config.priority <= 2 && !hasCritical,
    flags,
    advisoryNotes,
    codeReferences: [...new Set(codeReferences)],
  };
}

export function getSuggestedConfigs(doorType: DoorType, fireRated: boolean): PanicHardwareConfig[] {
  return PANIC_HARDWARE_CONFIGS
    .filter((c) => c.compatibleDoorTypes.includes(doorType) && (!fireRated || c.fireRatedCompatible))
    .sort((a, b) => a.priority - b.priority);
}
