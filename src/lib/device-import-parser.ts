/**
 * Pure parsing functions for device import.
 * Handles PDF text extraction (regex-based SKU detection) and
 * Excel/CSV structured column mapping.
 * No I/O or Supabase calls — all side-effect free.
 */

// ---- PDF SKU Detection ----

export const SKU_REGEX = /\b[A-Z0-9][A-Z0-9\-]{4,}[A-Z0-9]\b/g

/** Common strings that match SKU regex but aren't SKUs */
export const NOISE_STRINGS = new Set([
  'H264', 'H265', '802-3AF', '802-3AT', '802-3BT',
  'NFPA-101', 'IBC-2021', 'NDAA-889', 'ONVIF', 'OSDP-V2',
])

export function hasLetterAndDigit(s: string): boolean {
  return /[A-Z]/.test(s) && /[0-9]/.test(s)
}

// ---- Category Detection ----

export const CATEGORY_RULES: [string, RegExp][] = [
  ['vape_environmental', /vape|thc|smoke|gunshot|air quality|humidity|co2|environmental sensor/i],
  ['access_control', /controller|reader|lock|intercom|rex|power supply|access panel/i],
  ['network', /switch|firewall|wireless|router|\bap\b|ont|gateway|patch panel/i],
  ['av', /display|projector|speaker|amplifier|microphone|mixer|conferencing/i],
  ['cctv', /camera|nvr|vms|dome|bullet|ptz|lpr|fisheye|panoramic/i],
]

export function detectCategory(line: string): string {
  for (const [cat, regex] of CATEGORY_RULES) {
    if (regex.test(line)) return cat
  }
  return 'other'
}

// ---- Confidence Scoring (PDF) ----

const RESOLUTION_REGEX = /\b(\d{3,4}x\d{3,4}|\d+\s*MP)\b/i
const FPS_REGEX = /\b\d+\s*fps\b/i
const POE_REGEX = /802\.3a[ft]|802\.3bt/i
const WATTAGE_REGEX = /\b\d+\s*W\b/i
const NDAA_REGEX = /\bNDAA\b/i

export function computeConfidence(line: string, skuCount: number): number {
  let score = 0.2
  if (RESOLUTION_REGEX.test(line)) score += 0.15
  if (FPS_REGEX.test(line)) score += 0.15
  if (POE_REGEX.test(line)) score += 0.15
  if (WATTAGE_REGEX.test(line)) score += 0.05
  if (skuCount === 1) score += 0.15
  if (NDAA_REGEX.test(line)) score += 0.10
  if (line.length > 60) score += 0.05
  return Math.min(score, 1.0)
}

// ---- PDF Text → Parsed Rows ----

export interface ParsedImportRow {
  raw_line: string
  partnumber: string
  vendor: string | null
  model: string
  category: string
  subcategory: string | null
  resolution: string | null
  fps: string | null
  poe_standard: string | null
  wattage: number | null
  ndaa_compliant: boolean
  confidence: number
}

export function parsePdfText(text: string, batchVendor: string | null): ParsedImportRow[] {
  const lines = text.split('\n')
  const rows: ParsedImportRow[] = []

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    const upperLine = line.toUpperCase()
    const matches = upperLine.match(SKU_REGEX)
    if (!matches) continue

    const skus = matches.filter(
      (m) => hasLetterAndDigit(m) && !NOISE_STRINGS.has(m)
    )
    if (skus.length === 0) continue

    const category = detectCategory(line)
    const confidence = computeConfidence(line, skus.length)
    const ndaaFlagged = NDAA_REGEX.test(line)

    // Extract specs from line if detectable
    const resMatch = line.match(RESOLUTION_REGEX)
    const fpsMatch = line.match(FPS_REGEX)
    const poeMatch = line.match(POE_REGEX)
    const wattMatch = line.match(WATTAGE_REGEX)

    for (const sku of skus) {
      rows.push({
        raw_line: line.slice(0, 500),
        partnumber: sku,
        vendor: batchVendor,
        model: sku,
        category,
        subcategory: null,
        resolution: resMatch ? resMatch[0] : null,
        fps: fpsMatch ? fpsMatch[0] : null,
        poe_standard: poeMatch ? poeMatch[0] : null,
        wattage: wattMatch ? parseInt(wattMatch[0]) || null : null,
        ndaa_compliant: ndaaFlagged,
        confidence: Math.round(confidence * 100) / 100,
      })
    }
  }

  return rows
}

// ---- Excel/CSV Column Mapping ----

/** Map of canonical field → possible header names (lowercase) */
const COLUMN_MAP: Record<string, string[]> = {
  partnumber: ['partnumber', 'part_number', 'sku', 'part #', 'part no', 'partno', 'part_no', 'item number', 'item_number', 'item #'],
  model: ['model', 'model_number', 'model #', 'model_name', 'modelname', 'device'],
  vendor: ['vendor', 'manufacturer', 'brand', 'mfg', 'make'],
  category: ['category', 'type', 'device_type', 'device type', 'product_type', 'product type'],
  subcategory: ['subcategory', 'sub_category', 'sub category', 'subcat'],
  resolution: ['resolution', 'megapixel', 'mp', 'megapixels'],
  fps: ['fps', 'frame_rate', 'framerate', 'frame rate'],
  poe_standard: ['poe', 'poe_standard', 'poe standard', 'poe_type'],
  wattage: ['wattage', 'watts', 'power', 'power_consumption', 'w'],
  ndaa_compliant: ['ndaa', 'ndaa_compliant', 'ndaa compliant'],
}

function matchHeader(header: string): string | null {
  const h = header.toLowerCase().trim()
  for (const [field, aliases] of Object.entries(COLUMN_MAP)) {
    if (aliases.includes(h)) return field
  }
  return null
}

function parseBoolish(val: unknown): boolean {
  if (typeof val === 'boolean') return val
  const s = String(val).toLowerCase().trim()
  return s === 'true' || s === 'yes' || s === '1' || s === 'y'
}

function parseNumberish(val: unknown): number | null {
  if (val == null || val === '') return null
  const n = parseFloat(String(val))
  return isNaN(n) ? null : n
}

export interface SpreadsheetRow {
  [key: string]: unknown
}

export function parseSpreadsheetRows(
  headers: string[],
  dataRows: SpreadsheetRow[],
  batchVendor: string | null,
): ParsedImportRow[] {
  // Build column index map
  const colMap: Record<string, number> = {}
  for (let i = 0; i < headers.length; i++) {
    const field = matchHeader(headers[i])
    if (field && !(field in colMap)) {
      colMap[field] = i
    }
  }

  const results: ParsedImportRow[] = []

  for (const row of dataRows) {
    const vals = headers.map((h) => row[h])

    const partnumber = colMap.partnumber != null ? String(vals[colMap.partnumber] ?? '').trim() : ''
    const model = colMap.model != null ? String(vals[colMap.model] ?? '').trim() : ''

    // Skip rows with no identifiable data
    if (!partnumber && !model) continue

    const rowVendor = colMap.vendor != null ? String(vals[colMap.vendor] ?? '').trim() : ''
    const categoryRaw = colMap.category != null ? String(vals[colMap.category] ?? '').trim() : ''
    const category = categoryRaw ? detectCategory(categoryRaw) : 'other'
    const subcategory = colMap.subcategory != null ? String(vals[colMap.subcategory] ?? '').trim() || null : null
    const resolution = colMap.resolution != null ? String(vals[colMap.resolution] ?? '').trim() || null : null
    const fps = colMap.fps != null ? String(vals[colMap.fps] ?? '').trim() || null : null
    const poe_standard = colMap.poe_standard != null ? String(vals[colMap.poe_standard] ?? '').trim() || null : null
    const wattage = colMap.wattage != null ? parseNumberish(vals[colMap.wattage]) : null
    const ndaa = colMap.ndaa_compliant != null ? parseBoolish(vals[colMap.ndaa_compliant]) : false

    // Structured data gets higher base confidence
    let confidence = 0.7
    if (partnumber) confidence += 0.1
    if (resolution) confidence += 0.05
    if (poe_standard) confidence += 0.05
    if (fps) confidence += 0.05
    confidence = Math.min(confidence, 1.0)

    results.push({
      raw_line: headers.map((h, i) => `${h}: ${String(vals[i] ?? '')}`).join(' | ').slice(0, 500),
      partnumber: partnumber || model,
      vendor: rowVendor || batchVendor,
      model: model || partnumber,
      category,
      subcategory,
      resolution,
      fps,
      poe_standard,
      wattage,
      ndaa_compliant: ndaa,
      confidence: Math.round(confidence * 100) / 100,
    })
  }

  return results
}
