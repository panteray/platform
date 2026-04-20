#!/usr/bin/env node
/**
 * Device Library Element Profile Importer
 *
 * Reads every *.xlsx in the source directory (System Surveyor element profiles),
 * dedupes by element name + vendor/model, unions schemas across vendors,
 * and emits:
 *   - 01_device_elements.sql   — elements with attribute_schema JSONB
 *   - 02_device_library_items.sql — profiles (org_id NULL = global)
 *   - 03_device_item_accessories.sql — accessory links
 *   - import_log.txt — stats
 */

import XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const SRC_DIR = '/Users/dextergaspard/Downloads/Device Library Elements'
const OUT_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), 'out')
fs.mkdirSync(OUT_DIR, { recursive: true })

/* ─── Element name → category mapping ─── */
const CATEGORY_MAP = {
  // cctv
  'Fixed Camera': 'cctv', 'Multi-Lens Camera': 'cctv', 'PTZ Camera': 'cctv',
  'Video Doorbell': 'cctv', 'License Plate Reader': 'cctv', 'IR Illuminator': 'cctv',
  // access_control
  'ACS Controller': 'access_control', 'ACS Expansion Module': 'access_control',
  'ACS Power Supply': 'access_control', 'Card Reader': 'access_control',
  'Elec Lockset': 'access_control', 'Electric Strike': 'access_control',
  'Magnetic Lock': 'access_control', 'Elec Exit Device': 'access_control',
  'Request to Exit': 'access_control', 'Door Contact': 'access_control',
  'Automatic Door Operator': 'access_control', 'Single Door': 'access_control',
  'Double Door': 'access_control',
  // servers_nvr
  'NVR-DVR': 'servers_nvr', 'NVR/DVR': 'servers_nvr', 'VMS Software': 'servers_nvr',
  'Server': 'servers_nvr', 'Analog Video Encoder': 'servers_nvr',
  'Video Wall': 'servers_nvr',
  // network
  'Network Switch': 'network', 'Wireless Access Point': 'network',
  // intrusion
  'IDS Panel': 'intrusion', 'IDS Keypad': 'intrusion', 'IDS Expansion Module': 'intrusion',
  'Motion Detector': 'intrusion', 'Glass Break Detector': 'intrusion',
  'Panic Button': 'intrusion', 'Window Contact': 'intrusion',
  'Cellular Communicator': 'intrusion', 'Wireless Receiver Hub': 'intrusion',
  'Alarm Sounder': 'intrusion', 'Alarm Strobe': 'intrusion', 'Siren': 'intrusion',
  // fire
  'FA Control Panel': 'fire', 'FA Annunciator Panel': 'fire', 'FA Communicator': 'fire',
  'FA Expander Panel': 'fire', 'FA Power Supply': 'fire', 'FA Pull Station': 'fire',
  'Smoke Detector': 'fire', 'Heat Detector': 'fire', 'Carbon Monoxide Detector': 'fire',
  // av
  'Intercom End Point': 'av', 'Intercom Master Station': 'av',
  'Microphone': 'av', 'Speaker': 'av',
  // vape_environmental
  'Vape Sensor': 'vape_environmental', 'Water Sensor': 'vape_environmental',
  'Bill Trap Sensor': 'vape_environmental',
  'General Multi-Sensor Device': 'vape_environmental',
  // other
  'Relay': 'other', 'Battery': 'other', 'Enclosure': 'other', 'General Component': 'other',
}

/** Filename → element name inference. */
function inferElementName(filename) {
  // Strip prefix vendor tokens: "Axis_", "Eagle Eye - ", "avigilon_", "Triton Sensors "
  let name = filename.replace(/\.xlsx$/i, '')
  // Strip vendor prefix
  name = name.replace(/^(Axis|Eagle Eye - |avigilon_|Triton Sensors |iPRO )\s*_?\s*/i, '')
  // Strip "-Element_Profile" / " Element Profile" + anything after
  name = name.replace(/[-_\s]*element[_\s]*profile.*$/i, '')
  // Strip "-Verkada" / "_Verkada" vendor suffix before normalization
  name = name.replace(/[-_\s]+(Verkada|Axis|Hanwha|Allegion|Avigilon|I-PRO|iPRO|Eagle Eye|Triton Sensors)$/i, '')
  name = name.replace(/\s*copy( \d+)?$/i, '')
  name = name.replace(/\s*\(\d+\)$/, '')
  name = name.replace(/\s*\[\d+\]$/, '')
  name = name.replace(/[-_\s]*q\d_\d{4}$/i, '')
  name = name.replace(/[-_\s]*\d{4,8}([-\._]\d{2,4})*$/, '')
  name = name.replace(/_Allegion.*$/i, '')
  name = name.replace(/[-_\s]*-\s*current$/i, '')
  name = name.replace(/\s+FCAM\s+EPs?$/i, ' Fixed Camera') // iPRO naming
  name = name.trim()
  // Normalize known variants
  const aliases = {
    'NVR DVR': 'NVR-DVR', 'NVR': 'NVR-DVR',
    'ACS controller': 'ACS Controller',
    'ACS expansion': 'ACS Expansion Module',
    'card readers': 'Card Reader',
    'fixed cameras': 'Fixed Camera',
    'intercoms master station': 'Intercom Master Station',
    'license plate reader camera': 'License Plate Reader',
    'multi-lens cameras': 'Multi-Lens Camera',
    'ptz camera': 'PTZ Camera',
    'FCAM EPs': 'Fixed Camera',
  }
  if (aliases[name]) return aliases[name]
  const normalized = name.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
  if (aliases[normalized]) return aliases[normalized]
  // Case-insensitive alias match
  const lower = normalized.toLowerCase()
  for (const k of Object.keys(aliases)) {
    if (k.toLowerCase() === lower) return aliases[k]
  }
  return normalized
}

/** Find column indices for the "Attribute Tab" row — detects layout offset. */
function findLayout(rows) {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const r = rows[i] || []
    for (let c = 0; c < r.length; c++) {
      if (r[c] === 'Attribute Tab') {
        // Section col = c, Attr col = c+1, profiles start at c+2 with header being "XYZ Element Attributes"
        return { sectionCol: c, attrCol: c + 1, profileStart: c + 2, headerRow: i }
      }
    }
  }
  return null
}

/** Normalize attribute name: strip leading whitespace (sub-option marker), trim, collapse whitespace. */
function cleanAttr(a) {
  if (a == null) return null
  const s = String(a).replace(/\r/g, '').trim().replace(/\s+/g, ' ')
  return s || null
}
function isSubOption(raw) {
  if (raw == null) return false
  return /^\s{2,}/.test(String(raw)) || String(raw).startsWith('      ')
}

/** Parse one xlsx and return { elementName, schema, profiles, accessoryCatalog } */
function parseElementFile(filepath) {
  const wb = XLSX.readFile(filepath)
  const elemSheet = wb.Sheets['Element Profiles']
  if (!elemSheet) return null
  const rows = XLSX.utils.sheet_to_json(elemSheet, { header: 1, raw: false, defval: null })
  const layout = findLayout(rows)
  if (!layout) return null

  // Extract profile names from row after headerRow (the "Attribute Tab" row's profile columns)
  const attrHeaderRow = rows[layout.headerRow] || []
  const profileNames = []
  for (let c = layout.profileStart; c < attrHeaderRow.length; c++) {
    const v = attrHeaderRow[c]
    if (v && String(v).trim()) profileNames.push({ col: c, name: String(v).trim() })
  }
  // Allow zero-profile templates — still extract schema

  // Walk schema + values
  const schema = []        // [{ section, attr, isMulti, options: [] }]
  const profileAttrs = {}  // profileName → { attr: value, multi: {attr: [options]} }
  for (const p of profileNames) profileAttrs[p.name] = { attrs: {}, multi: {} }

  let currentSection = 'Name'
  let currentParent = null
  let currentParentMulti = false

  for (let i = layout.headerRow + 1; i < rows.length; i++) {
    const r = rows[i] || []
    const sectionVal = r[layout.sectionCol]
    const attrRaw = r[layout.attrCol]
    if (sectionVal && String(sectionVal).trim()) {
      const s = String(sectionVal).trim()
      if (['Name','Installation','Functional','Maintenance','Configuration','Accessories'].includes(s)) {
        currentSection = s
      }
    }
    if (attrRaw == null || String(attrRaw).trim() === '') continue
    const attrClean = cleanAttr(attrRaw)
    if (!attrClean) continue
    const sub = isSubOption(attrRaw)

    if (sub && currentParent) {
      // Sub-option row: add to parent attribute's options; record YES markers per profile
      const parentSchema = schema.find(x => x.section === currentSection && x.attr === currentParent)
      if (parentSchema) {
        if (!parentSchema.options.includes(attrClean)) parentSchema.options.push(attrClean)
        parentSchema.isMulti = true
      }
      for (const p of profileNames) {
        const v = r[p.col]
        if (v && String(v).trim().toUpperCase() === 'YES') {
          if (!profileAttrs[p.name].multi[currentParent]) profileAttrs[p.name].multi[currentParent] = []
          if (!profileAttrs[p.name].multi[currentParent].includes(attrClean)) {
            profileAttrs[p.name].multi[currentParent].push(attrClean)
          }
        }
      }
    } else {
      // Top-level attribute
      currentParent = attrClean
      currentParentMulti = false
      let existing = schema.find(x => x.section === currentSection && x.attr === attrClean)
      if (!existing) {
        existing = { section: currentSection, attr: attrClean, isMulti: false, options: [] }
        schema.push(existing)
      }
      for (const p of profileNames) {
        const v = r[p.col]
        if (v != null && String(v).trim() !== '') {
          profileAttrs[p.name].attrs[attrClean] = String(v).trim()
        }
      }
    }
  }

  // Accessory catalog from second sheet
  const accSheet = wb.Sheets['Accessories']
  const accessoryCatalog = []
  if (accSheet) {
    const accRows = XLSX.utils.sheet_to_json(accSheet, { header: 1, raw: false, defval: null })
    // Find header row
    let headerIdx = -1
    for (let i = 0; i < Math.min(accRows.length, 5); i++) {
      const r = accRows[i] || []
      if (r.some(c => c === 'Description') && r.some(c => c === 'Model')) {
        headerIdx = i; break
      }
    }
    if (headerIdx >= 0) {
      const hdr = accRows[headerIdx]
      const descIdx = hdr.indexOf('Description')
      const mfgIdx = hdr.indexOf('Manufacturer')
      const modelIdx = hdr.indexOf('Model')
      const priceIdx = hdr.indexOf('Price')
      for (let i = headerIdx + 1; i < accRows.length; i++) {
        const r = accRows[i] || []
        const desc = r[descIdx]; const mfg = r[mfgIdx]; const model = r[modelIdx]; const price = r[priceIdx]
        if (desc && mfg && model) {
          accessoryCatalog.push({
            description: String(desc).trim(),
            vendor: String(mfg).trim(),
            model: String(model).trim(),
            price: price ? Number(String(price).replace(/[^0-9.]/g, '')) || null : null,
          })
        }
      }
    }
  }

  return {
    elementName: null,  // set by caller
    schema,
    profiles: profileNames.map(p => ({
      name: p.name,
      attrs: profileAttrs[p.name].attrs,
      multi: profileAttrs[p.name].multi,
    })),
    accessoryCatalog,
  }
}

/* ─── Main ─── */
const files = fs.readdirSync(SRC_DIR).filter(f => f.endsWith('.xlsx')).sort()
console.log(`Found ${files.length} xlsx files.\n`)

// elementName → { schema: Map<section+attr, {section, attr, isMulti, options: Set}>, profiles: Map<vendor+model, profile>, accessories: Map<desc+vendor+model, accessory> }
const elements = new Map()

const log = []
let parsedCount = 0, skippedCount = 0

for (const file of files) {
  const elementName = inferElementName(file)
  if (!elementName) { skippedCount++; log.push(`SKIP (no element name): ${file}`); continue }
  if (!CATEGORY_MAP[elementName]) {
    skippedCount++
    log.push(`SKIP (unmapped element "${elementName}"): ${file}`)
    continue
  }
  try {
    const parsed = parseElementFile(path.join(SRC_DIR, file))
    if (!parsed) { skippedCount++; log.push(`SKIP (no Element Profiles sheet): ${file}`); continue }
    parsedCount++
    if (!elements.has(elementName)) {
      elements.set(elementName, {
        schema: new Map(), // section+attr → {section, attr, isMulti, options:Set}
        profiles: new Map(), // vendor|model → profile row
        accessories: new Map(), // vendor|model → { description, vendor, model, price }
        sourceFiles: [],
      })
    }
    const e = elements.get(elementName)
    e.sourceFiles.push(file)

    // Union schema
    for (const s of parsed.schema) {
      const key = s.section + '|' + s.attr
      let ex = e.schema.get(key)
      if (!ex) {
        ex = { section: s.section, attr: s.attr, isMulti: s.isMulti, options: new Set() }
        e.schema.set(key, ex)
      }
      if (s.isMulti) ex.isMulti = true
      for (const o of s.options) ex.options.add(o)
    }

    // Dedupe profiles by vendor|model (latest wins on duplicate)
    for (const p of parsed.profiles) {
      const vendor = p.attrs['Component Manufacturer'] || 'Unknown'
      const model = p.attrs['Component Model #'] || p.name
      const key = (vendor + '|' + model).toLowerCase()
      e.profiles.set(key, { vendor, model, name: p.name, attrs: p.attrs, multi: p.multi, sourceFile: file })
    }
    // Dedupe accessories by vendor|model
    for (const a of parsed.accessoryCatalog) {
      const key = (a.vendor + '|' + a.model).toLowerCase()
      if (!e.accessories.has(key)) e.accessories.set(key, a)
    }
    log.push(`OK   ${file} → ${elementName} (${parsed.profiles.length} profiles, ${parsed.accessoryCatalog.length} accessories)`)
  } catch (err) {
    skippedCount++
    log.push(`FAIL ${file}: ${err.message}`)
  }
}

/* ─── Emit SQL ─── */

const q = s => s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`
const qj = o => `'${JSON.stringify(o).replace(/'/g, "''")}'::jsonb`

// Element UUIDs deterministic by name
function elementId(name) {
  return crypto.createHash('md5').update('element:' + name).digest('hex')
    .replace(/(.{8})(.{4})(.{4})(.{4})(.{12}).*/, '$1-$2-$3-$4-$5')
}
function itemId(vendor, model, elementName) {
  return crypto.createHash('md5').update('item:' + vendor + '|' + model + '|' + elementName).digest('hex')
    .replace(/(.{8})(.{4})(.{4})(.{4})(.{12}).*/, '$1-$2-$3-$4-$5')
}

const elementsSql = []
elementsSql.push('-- Device Library Elements (auto-generated seed)')
elementsSql.push('-- One row per element type with its attribute schema unioned across vendor packs.\n')
for (const [name, e] of [...elements.entries()].sort()) {
  const cat = CATEGORY_MAP[name]
  const schemaArr = [...e.schema.values()].map(s => ({
    section: s.section,
    attr: s.attr,
    type: (s.isMulti || s.options.size > 0) ? 'multi' : 'text',
    options: [...s.options].sort(),
  }))
  const eid = elementId(name)
  elementsSql.push(
    `INSERT INTO device_elements (id, name, category, attribute_schema) VALUES ` +
    `(${q(eid)}, ${q(name)}, ${q(cat)}, ${qj(schemaArr)}) ` +
    `ON CONFLICT (name) DO UPDATE SET category = EXCLUDED.category, attribute_schema = EXCLUDED.attribute_schema;`
  )
}
fs.writeFileSync(path.join(OUT_DIR, '01_device_elements.sql'), elementsSql.join('\n') + '\n')

// Profiles
const profilesSql = []
profilesSql.push('-- Device Library Profiles (auto-generated seed)')
profilesSql.push('-- org_id NULL = global catalog. Attributes JSONB keyed by element schema attr names.\n')
let totalProfiles = 0
for (const [name, e] of elements) {
  const eid = elementId(name)
  const cat = CATEGORY_MAP[name]
  for (const [, p] of e.profiles) {
    totalProfiles++
    const attributes = { ...p.attrs, ...Object.fromEntries(Object.entries(p.multi).map(([k,v]) => [k, v])) }
    const priceRaw = p.attrs['Device Price']
    const price = priceRaw ? Number(String(priceRaw).replace(/[^0-9.]/g, '')) : null
    const iid = itemId(p.vendor, p.model, name)
    profilesSql.push(
      `INSERT INTO device_library_items (id, org_id, element_id, vendor, model, category, attributes, ndaa_compliant, specs) VALUES ` +
      `(${q(iid)}, NULL, ${q(eid)}, ${q(p.vendor)}, ${q(p.model)}, ${q(cat)}, ${qj(attributes)}, false, '{}'::jsonb) ` +
      `ON CONFLICT (id) DO UPDATE SET attributes = EXCLUDED.attributes, element_id = EXCLUDED.element_id;`
    )
  }
}
fs.writeFileSync(path.join(OUT_DIR, '02_device_library_items.sql'), profilesSql.join('\n') + '\n')

// Accessories — seed each accessory catalog entry as a library item in category 'other',
// then (phase 2) link via device_item_accessories
const accSql = []
accSql.push('-- Device Library Accessories (auto-generated seed)')
accSql.push('-- Each accessory becomes a library_item (category=other), linked to parent profiles via device_item_accessories.\n')
let totalAcc = 0, totalLinks = 0
const accessoryItemIds = new Map() // vendor|model → itemId
for (const [elementName, e] of elements) {
  for (const [, a] of e.accessories) {
    totalAcc++
    const iid = itemId(a.vendor, a.model, '__accessory__')
    accessoryItemIds.set((a.vendor + '|' + a.model).toLowerCase(), iid)
    accSql.push(
      `INSERT INTO device_library_items (id, org_id, element_id, vendor, model, category, attributes, ndaa_compliant, specs) VALUES ` +
      `(${q(iid)}, NULL, NULL, ${q(a.vendor)}, ${q(a.model)}, 'other', ${qj({ description: a.description, price: a.price, is_accessory: true })}, false, '{}'::jsonb) ` +
      `ON CONFLICT (id) DO NOTHING;`
    )
  }
  // Link accessories referenced on profiles
  for (const [, p] of e.profiles) {
    for (let n = 1; n <= 10; n++) {
      const ref = p.attrs['Accessory ' + n]
      if (!ref) continue
      // Match accessory by description
      let match = null
      for (const [, a] of e.accessories) {
        if (a.description === ref) { match = a; break }
      }
      if (match) {
        const parentIid = itemId(p.vendor, p.model, elementName)
        const accIid = itemId(match.vendor, match.model, '__accessory__')
        totalLinks++
        accSql.push(
          `INSERT INTO device_item_accessories (item_id, accessory_item_id, quantity) VALUES ` +
          `(${q(parentIid)}, ${q(accIid)}, 1) ON CONFLICT DO NOTHING;`
        )
      }
    }
  }
}
fs.writeFileSync(path.join(OUT_DIR, '03_device_item_accessories.sql'), accSql.join('\n') + '\n')

// Log
const summary = [
  `Device Library Import Log`,
  `=========================`,
  `Parsed: ${parsedCount}`,
  `Skipped: ${skippedCount}`,
  `Unique elements: ${elements.size}`,
  `Total profiles: ${totalProfiles}`,
  `Total accessories: ${totalAcc}`,
  `Profile ↔ accessory links: ${totalLinks}`,
  ``,
  `Per-element breakdown:`,
  ...[...elements.entries()].sort().map(([n, e]) =>
    `  ${n.padEnd(35)} [${CATEGORY_MAP[n]}] — ${e.profiles.size} profiles, ${e.accessories.size} accessories, schema: ${e.schema.size} attrs`
  ),
  ``,
  `File-by-file log:`,
  ...log,
]
fs.writeFileSync(path.join(OUT_DIR, 'import_log.txt'), summary.join('\n') + '\n')

console.log(summary.slice(0, 10).join('\n'))
console.log(`\nOutput written to: ${OUT_DIR}`)
