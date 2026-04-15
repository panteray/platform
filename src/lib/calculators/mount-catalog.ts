/**
 * Panteray — Mount Catalog Loader
 *
 * Static lookup over /public/data/mount_data.json (556 models across Hanwha,
 * Verkada, Avigilon). Provides vendor-specific SKU recommendations for a
 * given camera model + mount location. Fed into `calculateMountRequirements`
 * as an optional parameter — engine returns empty vendorParts when no catalog
 * is provided or no match is found. Never throws.
 */

// ---- Types ----

export interface VendorMountPart {
  location: string // "Wall" | "Ceiling" | "Ceiling Tile" | "Corner" | "Pole" | "Recessed Ceiling"
  part: string
  environment: string // "Both" | "Interior"
  heightGuidance: string
  jboxRequired: string
  jboxPart: string
  notes: string
}

export interface MountCatalog {
  [vendor: string]: {
    [model: string]: VendorMountPart[]
  }
}

interface RawRecord {
  location?: string
  part?: string
  notes?: string
  environment?: string
  height_guidance?: string
  jbox_required?: string
  jbox_part?: string
}

type RawCatalog = Record<string, Record<string, RawRecord[]>>

// ---- Constants ----

export const MOUNT_CATALOG_VENDORS = ['Hanwha', 'Verkada', 'Avigilon', 'Axis'] as const

export type MountCatalogVendor = (typeof MOUNT_CATALOG_VENDORS)[number]

// Canvas mount type → JSON location values
const LOCATION_MAP: Record<string, string[]> = {
  ceiling: ['Ceiling', 'Ceiling Tile', 'Recessed Ceiling'],
  wall: ['Wall', 'Corner'],
  pole: ['Pole'],
  pendant: ['Pendant'],
}

// Axis fallback catalog — hardcoded from NDAA_Mount_Expert docx reference.
// Axis publishes generic adapters that apply to most current-gen models, so
// we index under a single `_default` model key and let `lookupMountParts`
// fall back to it when a specific Axis model isn't in the catalog.
const AXIS_FALLBACK_RECORDS: VendorMountPart[] = [
  {
    location: 'Wall',
    part: 'AXIS T91E61 Wall Mount',
    environment: 'Both',
    heightGuidance: '8–14 ft typical; confirm per site',
    jboxRequired: 'As Required',
    jboxPart: '',
    notes: 'Generic wall mount for Axis fixed domes/bullets',
  },
  {
    location: 'Corner',
    part: 'AXIS T91E61 + T94R01B Corner Bracket',
    environment: 'Both',
    heightGuidance: '8–14 ft typical',
    jboxRequired: 'As Required',
    jboxPart: '',
    notes: 'Wall mount plus corner adapter',
  },
  {
    location: 'Pendant',
    part: 'AXIS T94B02D Pendant Kit',
    environment: 'Both',
    heightGuidance: 'Drop per ceiling height',
    jboxRequired: 'As Required',
    jboxPart: '',
    notes: 'Pendant adapter for Axis domes',
  },
  {
    location: 'Recessed Ceiling',
    part: 'AXIS T94M02L Recessed Flush Mount Kit',
    environment: 'Interior',
    heightGuidance: '9–12 ft typical drop-ceiling',
    jboxRequired: 'As Required',
    jboxPart: '',
    notes: 'Flush-mount kit for suspended ceilings',
  },
  {
    location: 'Pole',
    part: 'AXIS T91E61 + T91A47 Pole Mount',
    environment: 'Both',
    heightGuidance: '10–20 ft typical',
    jboxRequired: 'As Required',
    jboxPart: '',
    notes: 'Wall mount with pole adapter',
  },
]

const AXIS_DEFAULT_KEY = '_default'

// ---- Loader (module-level memoization) ----

let cached: MountCatalog | null = null
let inflight: Promise<MountCatalog> | null = null

export async function loadMountCatalog(): Promise<MountCatalog> {
  if (cached) return cached
  if (inflight) return inflight
  inflight = fetch('/data/mount_data.json')
    .then((r) => (r.ok ? r.json() : {}))
    .then((raw: RawCatalog) => normalize(raw))
    .then((c) => {
      cached = c
      inflight = null
      return c
    })
    .catch(() => {
      inflight = null
      return {}
    })
  return inflight
}

function normalize(raw: RawCatalog): MountCatalog {
  const out: MountCatalog = {}
  for (const vendor of Object.keys(raw)) {
    out[vendor] = {}
    for (const model of Object.keys(raw[vendor])) {
      out[vendor][model] = raw[vendor][model].map((r) => ({
        location: r.location ?? '',
        part: r.part ?? '',
        environment: r.environment ?? '',
        heightGuidance: r.height_guidance ?? '',
        jboxRequired: r.jbox_required ?? '',
        jboxPart: r.jbox_part ?? '',
        notes: r.notes ?? '',
      }))
    }
  }
  // Merge Axis fallback under a single _default model
  if (!out.Axis) out.Axis = {}
  if (!out.Axis[AXIS_DEFAULT_KEY]) {
    out.Axis[AXIS_DEFAULT_KEY] = AXIS_FALLBACK_RECORDS
  }
  return out
}

/**
 * Swap Hanwha/Wisenet finish suffix: parts ending in `W` (white) or `B` (black)
 * can be re-suffixed to match the requested finish. Leaves other vendors alone.
 */
export function applyFinish(part: string, finish?: 'white' | 'black'): string {
  if (!finish || !part) return part
  const last = part.charAt(part.length - 1)
  if (finish === 'white' && last === 'B') return part.slice(0, -1) + 'W'
  if (finish === 'black' && last === 'W') return part.slice(0, -1) + 'B'
  return part
}

// ---- Lookup ----

export function lookupMountParts(
  catalog: MountCatalog | null | undefined,
  vendor: string | undefined,
  model: string | undefined,
  mountType: 'ceiling' | 'wall' | 'pole' | 'pendant',
  environment?: 'indoor' | 'outdoor' | 'indoor_outdoor',
  finish?: 'white' | 'black',
): VendorMountPart[] {
  if (!catalog || !vendor) return []
  const vendorKey = resolveVendorKey(catalog, vendor)
  if (!vendorKey) return []

  // Model resolution: exact match, else _default (Axis pattern), else no match
  let modelKey: string | null = null
  if (model) modelKey = resolveModelKey(catalog[vendorKey], model)
  if (!modelKey && catalog[vendorKey][AXIS_DEFAULT_KEY]) modelKey = AXIS_DEFAULT_KEY
  if (!modelKey) return []

  const records = catalog[vendorKey][modelKey]
  const allowedLocations = LOCATION_MAP[mountType] ?? []
  const filtered = records.filter((r) => {
    if (allowedLocations.length > 0 && !allowedLocations.includes(r.location)) return false
    if (environment === 'outdoor' && r.environment !== 'Both') return false
    // 'indoor' and 'indoor_outdoor' accept both 'Interior' and 'Both'
    return true
  })

  // Apply finish suffix swap (Hanwha W/B convention)
  if (finish) {
    return filtered.map((r) => ({ ...r, part: applyFinish(r.part, finish) }))
  }
  return filtered
}

// Case-insensitive vendor match (catalog keys are Title Case)
function resolveVendorKey(catalog: MountCatalog, vendor: string): string | null {
  const lower = vendor.toLowerCase()
  for (const k of Object.keys(catalog)) {
    if (k.toLowerCase() === lower) return k
  }
  return null
}

// Case-insensitive model match
function resolveModelKey(models: Record<string, VendorMountPart[]>, model: string): string | null {
  const lower = model.toLowerCase()
  for (const k of Object.keys(models)) {
    if (k.toLowerCase() === lower) return k
  }
  return null
}

// ---- Browse helper (for standalone form model dropdown) ----

export function listModelsForVendor(catalog: MountCatalog | null, vendor: string): string[] {
  if (!catalog) return []
  const key = resolveVendorKey(catalog, vendor)
  if (!key) return []
  return Object.keys(catalog[key]).sort()
}
