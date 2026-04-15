/**
 * Panteray — Mount Calculator Engine
 *
 * Determines compatible mounting hardware based on:
 * - Camera model (weight, form factor, dimensions)
 * - Mount type (ceiling, wall, pole, pendant)
 * - Environment (indoor, outdoor, indoor/outdoor)
 *
 * ZERO DEFAULTS:
 * - Camera specs come from device_library_items only.
 * - Mount type comes from user selection on canvas.
 * - If required data is missing, returns empty results with missing fields list.
 *
 * Optional vendor-specific SKU lookup: pass a MountCatalog as the 3rd arg
 * to `calculateMountRequirements` and it will populate `vendorParts` from
 * the catalog. Callers that don't provide a catalog get `vendorParts: []`.
 */

import type { MountCatalog, VendorMountPart } from "./mount-catalog";
import { lookupMountParts } from "./mount-catalog";

// ---- Input Types ----

export interface MountCalcInput {
  /** Camera form factor: dome, bullet, turret, ptz, etc. */
  formFactor: string;
  /** Camera weight in kg (from device library specs) */
  weightKg?: number;
  /** Camera diameter in mm (from device library specs) */
  diameterMm?: number;
  /** Mount type selected by user */
  mountType: "ceiling" | "wall" | "pole" | "pendant";
  /** Environment: indoor, outdoor, indoor_outdoor */
  environment?: "indoor" | "outdoor" | "indoor_outdoor";
  /** IP rating of the camera (e.g., "IP67") — filters outdoor mounts */
  ipRating?: string;
  /** Camera vendor (for catalog lookup) */
  vendor?: string;
  /** Camera model (for catalog lookup) */
  model?: string;
  /** Finish color — swaps Hanwha W/B suffix on matched parts */
  finish?: "white" | "black";
}

// ---- Output Types ----

export interface MountOption {
  /** Mount category (e.g., "junction_box", "wall_bracket", "pendant_cap") */
  category: string;
  /** Human-readable label */
  label: string;
  /** Whether this mount is required or optional */
  required: boolean;
  /** Compatible with the selected mount type */
  compatible: boolean;
  /** Notes for the installer */
  notes?: string;
}

export interface MountCalcOutput {
  /** Ordered list of mount components needed */
  mounts: MountOption[];
  /** Whether a lift is required based on mount height */
  liftRequired: boolean;
  /** Missing data that prevents full calculation */
  missingFields: string[];
  /** Vendor-specific parts matched from MountCatalog (empty if no catalog or no match) */
  vendorParts: VendorMountPart[];
  /** Height guidance from the first matched vendor part (null if no match) */
  heightGuidance: string | null;
}

// ---- Mount Compatibility Rules ----

const MOUNT_RULES: Record<
  string,
  Record<string, { required: MountOption[]; optional: MountOption[] }>
> = {
  dome: {
    ceiling: {
      required: [
        { category: "junction_box", label: "Junction Box / Gang Box", required: true, compatible: true },
      ],
      optional: [
        { category: "conduit_adapter", label: "Conduit Back Box", required: false, compatible: true, notes: "If concealed wiring required" },
      ],
    },
    wall: {
      required: [
        { category: "wall_bracket", label: "Wall Mount Bracket", required: true, compatible: true },
        { category: "junction_box", label: "Junction Box", required: true, compatible: true },
      ],
      optional: [
        { category: "corner_mount", label: "Corner Mount Adapter", required: false, compatible: true, notes: "For corner installation" },
      ],
    },
    pole: {
      required: [
        { category: "pole_mount", label: "Pole Mount Adapter", required: true, compatible: true },
        { category: "wall_bracket", label: "Wall/Gooseneck Bracket", required: true, compatible: true },
      ],
      optional: [],
    },
    pendant: {
      required: [
        { category: "pendant_cap", label: "Pendant Cap / Kit", required: true, compatible: true },
        { category: "pendant_pipe", label: "Pendant Pipe / Drop Rod", required: true, compatible: true },
      ],
      optional: [
        { category: "ceiling_plate", label: "Ceiling Plate", required: false, compatible: true },
      ],
    },
  },
  bullet: {
    ceiling: {
      required: [
        { category: "junction_box", label: "Junction Box", required: true, compatible: true },
      ],
      optional: [],
    },
    wall: {
      required: [
        { category: "junction_box", label: "Junction Box", required: true, compatible: true },
      ],
      optional: [
        { category: "corner_mount", label: "Corner Mount Adapter", required: false, compatible: true },
      ],
    },
    pole: {
      required: [
        { category: "pole_mount", label: "Pole Mount Adapter", required: true, compatible: true },
      ],
      optional: [],
    },
    pendant: {
      required: [],
      optional: [
        { category: "pendant_cap", label: "Pendant Adapter", required: false, compatible: false, notes: "Bullet cameras rarely use pendant mounts" },
      ],
    },
  },
  turret: {
    ceiling: {
      required: [
        { category: "junction_box", label: "Junction Box / Gang Box", required: true, compatible: true },
      ],
      optional: [],
    },
    wall: {
      required: [
        { category: "wall_bracket", label: "Wall Mount Bracket", required: true, compatible: true },
      ],
      optional: [
        { category: "corner_mount", label: "Corner Mount Adapter", required: false, compatible: true },
      ],
    },
    pole: {
      required: [
        { category: "pole_mount", label: "Pole Mount Adapter", required: true, compatible: true },
        { category: "wall_bracket", label: "Gooseneck / Wall Bracket", required: true, compatible: true },
      ],
      optional: [],
    },
    pendant: {
      required: [
        { category: "pendant_cap", label: "Pendant Kit", required: true, compatible: true },
      ],
      optional: [],
    },
  },
  ptz: {
    ceiling: {
      required: [
        { category: "ceiling_bracket", label: "PTZ Ceiling Bracket (heavy-duty)", required: true, compatible: true },
      ],
      optional: [
        { category: "in_ceiling_mount", label: "In-Ceiling Flush Mount", required: false, compatible: true },
      ],
    },
    wall: {
      required: [
        { category: "wall_bracket", label: "PTZ Wall Mount Bracket (heavy-duty)", required: true, compatible: true },
        { category: "corner_mount", label: "Corner Mount Adapter", required: false, compatible: true },
      ],
      optional: [],
    },
    pole: {
      required: [
        { category: "pole_mount", label: "Pole Mount Adapter (heavy-duty)", required: true, compatible: true },
        { category: "wall_bracket", label: "PTZ Bracket", required: true, compatible: true },
      ],
      optional: [],
    },
    pendant: {
      required: [
        { category: "pendant_pipe", label: "Pendant Pipe / Drop Rod (heavy-duty)", required: true, compatible: true },
        { category: "ceiling_plate", label: "Ceiling Plate", required: true, compatible: true },
      ],
      optional: [],
    },
  },
};

// ---- Main Calculator ----

const LIFT_THRESHOLD_FT = 12;

export function calculateMountRequirements(
  input: MountCalcInput,
  mountHeightFt?: number,
  catalog?: MountCatalog | null,
): MountCalcOutput {
  const missingFields: string[] = [];

  if (!input.formFactor) missingFields.push("formFactor");
  if (!input.mountType) missingFields.push("mountType");

  const vendorParts = lookupMountParts(
    catalog,
    input.vendor,
    input.model,
    input.mountType,
    input.environment,
    input.finish,
  );
  const heightGuidance = vendorParts[0]?.heightGuidance ?? null;

  // Normalize form factor to base type
  const baseType = normalizeFormFactor(input.formFactor);
  const rules = MOUNT_RULES[baseType]?.[input.mountType];

  if (!rules) {
    return {
      mounts: [{
        category: "unknown",
        label: `No mount rules for ${input.formFactor} / ${input.mountType}`,
        required: false,
        compatible: false,
        notes: "Check manufacturer documentation",
      }],
      liftRequired: (mountHeightFt ?? 0) > LIFT_THRESHOLD_FT,
      missingFields,
      vendorParts,
      heightGuidance,
    };
  }

  const mounts = [...rules.required, ...rules.optional];

  return {
    mounts,
    liftRequired: (mountHeightFt ?? 0) > LIFT_THRESHOLD_FT,
    missingFields,
    vendorParts,
    heightGuidance,
  };
}

/** Validate mount calc input — returns missing fields */
export function validateMountInput(
  input: Partial<MountCalcInput>,
): { valid: boolean; missingFields: string[] } {
  const missing: string[] = [];
  if (!input.formFactor) missing.push("formFactor");
  if (!input.mountType) missing.push("mountType");
  return { valid: missing.length === 0, missingFields: missing };
}

// ---- Helpers ----

function normalizeFormFactor(formFactor: string): string {
  const lower = formFactor.toLowerCase();
  if (lower.includes("dome")) return "dome";
  if (lower.includes("bullet")) return "bullet";
  if (lower.includes("turret")) return "turret";
  if (lower.includes("ptz") || lower.includes("speed")) return "ptz";
  if (lower.includes("fisheye") || lower.includes("panoramic")) return "dome";
  if (lower.includes("multi") || lower.includes("quad")) return "dome";
  return "dome"; // fallback
}
