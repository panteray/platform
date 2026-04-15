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

export const MOUNT_CATALOG_VENDORS = ['Hanwha', 'Verkada', 'Avigilon'] as const

export type MountCatalogVendor = (typeof MOUNT_CATALOG_VENDORS)[number]

// Canvas mount type → JSON location values
const LOCATION_MAP: Record<string, string[]> = {
  ceiling: ['Ceiling', 'Ceiling Tile', 'Recessed Ceiling'],
  wall: ['Wall', 'Corner'],
  pole: ['Pole'],
  pendant: [],
}

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
  return out
}

// ---- Lookup ----

export function lookupMountParts(
  catalog: MountCatalog | null | undefined,
  vendor: string | undefined,
  model: string | undefined,
  mountType: 'ceiling' | 'wall' | 'pole' | 'pendant',
  environment?: 'indoor' | 'outdoor' | 'indoor_outdoor',
): VendorMountPart[] {
  if (!catalog || !vendor || !model) return []
  const vendorKey = resolveVendorKey(catalog, vendor)
  if (!vendorKey) return []
  const modelKey = resolveModelKey(catalog[vendorKey], model)
  if (!modelKey) return []
  const records = catalog[vendorKey][modelKey]
  const allowedLocations = LOCATION_MAP[mountType] ?? []
  return records.filter((r) => {
    if (allowedLocations.length > 0 && !allowedLocations.includes(r.location)) return false
    if (environment === 'outdoor' && r.environment !== 'Both') return false
    // 'indoor' and 'indoor_outdoor' accept both 'Interior' and 'Both'
    return true
  })
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
