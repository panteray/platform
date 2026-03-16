export interface ADAMountingConfig {
  minHeight: number;
  maxHeight: number;
  label: string;
  reference: string;
}

export interface ADAValidationResult {
  compliant: boolean;
  height: number;
  device: string;
  minHeight: number;
  maxHeight: number;
  message: string;
  reference: string;
}

export const DEFAULT_ADA_RANGES: Record<string, ADAMountingConfig> = {
  card_reader: {
    minHeight: 34,
    maxHeight: 48,
    label: "Card Reader",
    reference: "ADA 309.4, ICC A117.1 309.4",
  },
  rex_device: {
    minHeight: 34,
    maxHeight: 48,
    label: "REX Device",
    reference: "ADA 309.4",
  },
  panic_hardware: {
    minHeight: 34,
    maxHeight: 48,
    label: "Panic Hardware Actuator",
    reference: "ADA 404.2.7, ICC A117.1 404.2.7",
  },
  door_hardware: {
    minHeight: 34,
    maxHeight: 48,
    label: "Door Hardware (Operable Parts)",
    reference: "ADA 309.3, 404.2.7",
  },
};

export function validateMountingHeight(
  device: string,
  heightInches: number,
  customRange?: { min: number; max: number }
): ADAValidationResult {
  const config = DEFAULT_ADA_RANGES[device];
  if (!config) {
    return {
      compliant: false,
      height: heightInches,
      device,
      minHeight: 0,
      maxHeight: 0,
      message: "Unknown device type",
      reference: "",
    };
  }

  const min = customRange?.min ?? config.minHeight;
  const max = customRange?.max ?? config.maxHeight;
  const compliant = heightInches >= min && heightInches <= max;

  return {
    compliant,
    height: heightInches,
    device: config.label,
    minHeight: min,
    maxHeight: max,
    message: compliant
      ? `${config.label} at ${heightInches}" AFF is within ADA compliant range (${min}"-${max}" AFF).`
      : `${config.label} at ${heightInches}" AFF is OUTSIDE ADA compliant range (${min}"-${max}" AFF). Adjust mounting height.`,
    reference: config.reference,
  };
}
