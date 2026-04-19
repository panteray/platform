#!/usr/bin/env node
/**
 * Parse System Surveyor Element Profile xlsx files and emit SQL INSERTs
 * for device_library_items. Pivoted format: rows = attributes, cols = devices.
 *
 * Usage:
 *   node scripts/parse-element-profiles.mjs <input-dir> > seed.sql
 */

import XLSX from 'xlsx'
import { readdirSync, statSync } from 'node:fs'
import { join, basename } from 'node:path'

// ─── Category inference from filename ───
function inferCategory(fileName) {
  const n = fileName.toLowerCase()
  if (/(fixed|ptz|multi.?lens|multilens|box|dome|turret|bullet|fisheye).*camera|^axis_|_cameras_|\biPRO FCAM\b|FCAM EP|license plate reader|lpr/i.test(fileName)) return 'cctv'
  if (/camera|\bcam\b/.test(n) && !/intercom/.test(n)) return 'cctv'
  if (/acs |acs_|access control|card reader|electric strike|magnetic lock|elec lockset|elec exit|automatic door operator|wireless receiver hub|intercom|door contact|double door|single door|request to exit|battery|acs power/.test(n)) return 'access_control'
  if (/nvr|dvr|server|video wall/.test(n)) return 'servers_nvr'
  if (/network switch|analog video encoder|wireless access point|cellular communicator/.test(n)) return 'network'
  if (/speaker|microphone|ir illuminator|video doorbell/.test(n)) return 'av'
  if (/vape|smoke detector|heat detector|carbon monoxide|water sensor|glass break|motion detector|window contact|panic button|siren|alarm sounder|alarm strobe|bill trap|fa [a-z]+|ids [a-z]+|relay|fa_/.test(n)) return 'vape_environmental'
  return 'other'
}

// ─── Parser: finds the "Descriptive Label" row and builds per-column devices ───
function parseWorkbook(filePath) {
  const wb = XLSX.readFile(filePath)
  const sheet = wb.Sheets['Element Profiles'] || wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return []
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  if (grid.length === 0) return []

  // Find the row with "Descriptive Label" — tells us attr col and first device col
  let attrCol = -1, labelRow = -1
  for (let r = 0; r < Math.min(grid.length, 10); r++) {
    const row = grid[r]
    for (let c = 0; c < row.length; c++) {
      if (String(row[c]).trim().toLowerCase() === 'descriptive label') {
        attrCol = c; labelRow = r; break
      }
    }
    if (attrCol >= 0) break
  }
  if (attrCol < 0 || labelRow < 0) return []

  const deviceStartCol = attrCol + 1

  // Row above (labelRow - 1) typically has the partnumber-like headers
  const pnRow = grid[labelRow - 1] ?? []
  const labelRowData = grid[labelRow]

  // Build devices: one per column from deviceStartCol onward where labelRow has a non-empty value
  const devices = []
  const maxCol = Math.max(pnRow.length, labelRowData.length)
  for (let c = deviceStartCol; c < maxCol; c++) {
    const label = String(labelRowData[c] ?? '').trim()
    if (!label) continue
    const pnRaw = String(pnRow[c] ?? '').trim()
    devices.push({
      colIdx: c,
      label,
      pnRaw,
      attrs: {},
    })
  }
  if (devices.length === 0) return []

  // Walk remaining rows, each row contributes an attribute value per device
  for (let r = labelRow + 1; r < grid.length; r++) {
    const row = grid[r]
    const attrName = String(row[attrCol] ?? '').trim()
    if (!attrName) continue
    for (const dev of devices) {
      const val = row[dev.colIdx]
      if (val === '' || val == null) continue
      dev.attrs[attrName] = val
    }
  }

  return devices
}

// ─── Attribute normalization → columns we care about ───
function normalizeDevice(dev, category, fallbackVendor) {
  const a = dev.attrs
  const pick = (...keys) => {
    for (const k of keys) {
      if (a[k] != null && String(a[k]).trim() !== '') return String(a[k]).trim()
    }
    return null
  }

  const vendor = pick('Component Manufacturer', 'Manufacturer', 'Vendor') || fallbackVendor
  const partnumber = pick('Component Model #', 'Component Model', 'Part Number', 'Part #', 'Model Number', 'Model #') || dev.pnRaw || null
  const model = dev.label || partnumber || 'Unknown'
  const resolution = category === 'cctv' ? pick('Resolution', 'Max Resolution') : null
  const fps = category === 'cctv' ? pick('Max Frame Rate', 'Frame Rate', 'FPS') : null
  const focal_length = category === 'cctv' ? pick('Focal Length', 'Lens Focal Length') : null
  const aov = category === 'cctv' ? pick('Horizontal Angle of View', 'Angle of View', 'AoV', 'Field of View') : null
  const form = pick('Form Factor', 'Form', 'Camera Form Factor', 'Mount Type', 'Housing Type')
  const ir = category === 'cctv' ? pick('IR Range', 'IR Distance', 'IR Illumination') : null
  const environment = pick('Environment', 'Indoor/Outdoor', 'Installation Location')
  const poe_standard = pick('PoE Standard', 'PoE', 'Power over Ethernet')
  const wattageRaw = pick('Wattage', 'Power Consumption', 'Max Power', 'Power Draw')
  const wattage = wattageRaw ? parseFloat(String(wattageRaw).replace(/[^0-9.]/g, '')) || null : null
  const ndaaRaw = pick('NDAA Compliant', 'NDAA', 'NDAA 889 Compliant')
  const ndaa_compliant = ndaaRaw ? /yes|true|compliant|1/i.test(ndaaRaw) : false
  const ul_listed = !!pick('UL Listed', 'UL Listing', 'UL')

  // Everything else goes into specs JSONB
  const keep = new Set([
    'Component Manufacturer', 'Manufacturer', 'Vendor', 'Component Model #', 'Component Model',
    'Part Number', 'Part #', 'Model Number', 'Model #', 'Resolution', 'Max Resolution',
    'Max Frame Rate', 'Frame Rate', 'FPS', 'Focal Length', 'Lens Focal Length',
    'Horizontal Angle of View', 'Angle of View', 'AoV', 'Field of View',
    'Form Factor', 'Form', 'Camera Form Factor', 'Mount Type', 'Housing Type',
    'IR Range', 'IR Distance', 'IR Illumination', 'Environment', 'Indoor/Outdoor',
    'Installation Location', 'PoE Standard', 'PoE', 'Power over Ethernet',
    'Wattage', 'Power Consumption', 'Max Power', 'Power Draw',
    'NDAA Compliant', 'NDAA', 'NDAA 889 Compliant', 'UL Listed', 'UL Listing', 'UL',
    'Descriptive Label', 'Installation Status', 'Color', 'Element Quantity',
    'Device Price', 'Installation Hours', 'Room # / Location',
  ])
  const specs = {}
  for (const [k, v] of Object.entries(a)) {
    if (!keep.has(k)) specs[k] = v
  }

  return {
    vendor, model, partnumber, category, resolution, fps, focal_length, aov,
    form, ir, environment, poe_standard, wattage, ndaa_compliant, ul_listed, specs,
  }
}

// ─── SQL escaping ───
function sqlStr(v) {
  if (v == null) return 'NULL'
  return "'" + String(v).replace(/'/g, "''") + "'"
}
function sqlJson(obj) {
  if (!obj || Object.keys(obj).length === 0) return "'{}'::jsonb"
  return sqlStr(JSON.stringify(obj)) + '::jsonb'
}
function sqlNum(n) { return n == null || Number.isNaN(n) ? 'NULL' : String(n) }
function sqlBool(b) { return b ? 'TRUE' : 'FALSE' }

// ─── Main ───
function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (entry === '__MACOSX') continue
      out.push(...walk(full))
    } else if (entry.toLowerCase().endsWith('.xlsx') && !entry.startsWith('._')) {
      out.push(full)
    }
  }
  return out
}

const inputDir = process.argv[2]
if (!inputDir) { console.error('Usage: parse-element-profiles.mjs <dir>'); process.exit(1) }

const files = walk(inputDir)
const seen = new Set()
const records = []
let totalParsed = 0

for (const f of files) {
  const base = basename(f)
  const category = inferCategory(base)
  let devices
  try { devices = parseWorkbook(f) } catch (e) { process.stderr.write(`skip ${base}: ${e.message}\n`); continue }
  totalParsed += devices.length
  // Vendor fallback: infer from filename prefix (Axis_, avigilon_, Eagle Eye -, etc.)
  let fallbackVendor = null
  if (/^axis_/i.test(base)) fallbackVendor = 'Axis'
  else if (/^avigilon_/i.test(base)) fallbackVendor = 'Avigilon'
  else if (/^Eagle Eye/i.test(base)) fallbackVendor = 'Eagle Eye'
  else if (/I-PRO|iPRO/i.test(base)) fallbackVendor = 'i-PRO'
  else if (/Allegion/i.test(base)) fallbackVendor = 'Allegion'
  else if (/Verkada/i.test(base)) fallbackVendor = 'Verkada'
  else if (/Triton/i.test(base)) fallbackVendor = 'Triton Sensors'

  for (const dev of devices) {
    const norm = normalizeDevice(dev, category, fallbackVendor)
    if (!norm.vendor || norm.vendor === 'Unknown') continue
    const key = `${norm.vendor.toLowerCase()}::${(norm.partnumber || norm.model).toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    records.push(norm)
  }
}

// Emit SQL
const header = `-- Auto-generated from System Surveyor Element Profile xlsx files.
-- Source: Device Library Elements.zip (${files.length} files, ${totalParsed} device profiles parsed)
-- After dedup: ${records.length} unique rows.
-- Uses ON CONFLICT DO NOTHING against the unique indexes from 055_device_library_unique.sql
-- Rows are inserted as global (org_id = NULL) items visible to all orgs.

BEGIN;
`
const footer = `
COMMIT;
`

process.stdout.write(header)

// Batch inserts 500 rows at a time to keep statements manageable
const BATCH = 500
for (let i = 0; i < records.length; i += BATCH) {
  const batch = records.slice(i, i + BATCH)
  process.stdout.write(`
INSERT INTO device_library_items
  (org_id, vendor, model, partnumber, category, resolution, fps, focal_length, aov,
   form, ir, environment, poe_standard, wattage, ndaa_compliant, ul_listed, specs)
VALUES
`)
  process.stdout.write(batch.map(r =>
    `  (NULL, ${sqlStr(r.vendor)}, ${sqlStr(r.model)}, ${sqlStr(r.partnumber)}, ${sqlStr(r.category)}, ` +
    `${sqlStr(r.resolution)}, ${sqlStr(r.fps)}, ${sqlStr(r.focal_length)}, ${sqlStr(r.aov)}, ` +
    `${sqlStr(r.form)}, ${sqlStr(r.ir)}, ${sqlStr(r.environment)}, ${sqlStr(r.poe_standard)}, ` +
    `${sqlNum(r.wattage)}, ${sqlBool(r.ndaa_compliant)}, ${sqlBool(r.ul_listed)}, ${sqlJson(r.specs)})`
  ).join(',\n'))
  process.stdout.write('\nON CONFLICT DO NOTHING;\n')
}

process.stdout.write(footer)

process.stderr.write(`\nParsed ${totalParsed} profiles across ${files.length} files.\n`)
process.stderr.write(`Unique rows after dedup: ${records.length}\n`)
const byCategory = {}
for (const r of records) byCategory[r.category] = (byCategory[r.category] || 0) + 1
for (const [cat, n] of Object.entries(byCategory).sort((a,b)=>b[1]-a[1])) {
  process.stderr.write(`  ${cat}: ${n}\n`)
}
