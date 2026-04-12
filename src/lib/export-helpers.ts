import { DORI_THRESHOLDS } from '@/lib/calculators/fov-dori'

// ---- Types ----

interface BomItem {
  category: string
  label: string
  manufacturer: string
  model: string
  qty: number
  unitCost: number
}
interface BomExport {
  designName: string
  generatedAt: string
  totalLineItems: number
  totalDevices: number
  items: BomItem[]
}

interface MaterialDevice {
  label: string
  category: string
  status: string
  mount_type: string | null
  properties: Record<string, unknown>
  area_id: string | null
}
interface MaterialExport {
  designName: string
  generatedAt: string
  totalDevices: number
  devices: MaterialDevice[]
}

interface HardwareArea {
  areaId: string
  deviceCount: number
  devices: Array<{
    label: string
    category: string
    status: string
    mount_type: string | null
    position_x: number
    position_y: number
    properties: Record<string, unknown>
  }>
}
interface HardwareExport {
  designName: string
  generatedAt: string
  totalDevices: number
  areas: HardwareArea[]
}

interface CableItem {
  label: string
  cable_type: string
  length_ft: number | null
  slack_pct: number | null
  total_length_ft: number | null
  service_loop_ft: number | null
  from_device_id: string | null
  to_device_id: string | null
  mdf_idf_id: string | null
}
interface CableExport {
  designName: string
  generatedAt: string
  totalCables: number
  totalFootage: number
  mdfIdfs: Array<{ id: string; name: string }>
  cables: CableItem[]
}

// ---- Helpers ----

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_').substring(0, 60)
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export type ExportFormat = 'xlsx' | 'pdf' | 'docx'

async function toXlsx(rows: Record<string, unknown>[], sheetName: string): Promise<Blob> {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

/** Generate a print-ready HTML document for PDF export (browser print dialog) */
function toPdfPrint(title: string, rows: Record<string, unknown>[], columns: string[]) {
  const headerCells = columns.map(c => `<th style="border:1px solid #ddd;padding:6px 10px;background:#f5f5f5;font-size:11px;font-weight:600;text-align:left">${c}</th>`).join('')
  const bodyRows = rows.map(row =>
    `<tr>${columns.map(c => `<td style="border:1px solid #ddd;padding:5px 10px;font-size:11px">${row[c] ?? ''}</td>`).join('')}</tr>`
  ).join('')
  const html = `<!DOCTYPE html><html><head><title>${title}</title>
    <style>body{font-family:system-ui,sans-serif;max-width:1000px;margin:30px auto;padding:0 20px;color:#1a1a1a}
    h1{font-size:18px;border-bottom:2px solid #522F82;padding-bottom:6px;color:#522F82}
    table{width:100%;border-collapse:collapse;margin:12px 0}
    .meta{font-size:11px;color:#666;margin-bottom:16px}
    @media print{body{margin:0;padding:10px}}</style></head><body>
    <h1>${title}</h1>
    <div class="meta">Generated ${new Date().toLocaleDateString()} · ${rows.length} items</div>
    <table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>
    </body></html>`
  const w = window.open('', '_blank', 'width=900,height=700')
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500) }
}

/** Generate a DOCX blob from rows using the docx npm package */
async function toDocxBlob(title: string, rows: Record<string, unknown>[], columns: string[]): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, WidthType, BorderStyle, ShadingType } = await import('docx')
  const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }
  const borders = { top: border, bottom: border, left: border, right: border }
  const colW = Math.floor(9360 / columns.length)

  const headerRow = new TableRow({
    children: columns.map(c => new TableCell({
      borders, width: { size: colW, type: WidthType.DXA },
      shading: { fill: 'E8E8E8', type: ShadingType.CLEAR },
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
      children: [new Paragraph({ children: [new TextRun({ text: c, bold: true, font: 'Arial', size: 18 })] })],
    })),
  })

  const dataRows = rows.map(row => new TableRow({
    children: columns.map(c => new TableCell({
      borders, width: { size: colW, type: WidthType.DXA },
      margins: { top: 40, bottom: 40, left: 80, right: 80 },
      children: [new Paragraph({ children: [new TextRun({ text: String(row[c] ?? ''), font: 'Arial', size: 18 })] })],
    })),
  }))

  const doc = new Document({
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children: [
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: title, font: 'Arial' })] }),
        new Paragraph({ children: [new TextRun({ text: `Generated ${new Date().toLocaleDateString()} · ${rows.length} items`, font: 'Arial', size: 18, color: '888888' })] }),
        new Paragraph({ children: [] }),
        new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: columns.map(() => colW), rows: [headerRow, ...dataRows] }),
      ],
    }],
  })
  return await Packer.toBlob(doc)
}

/** Export rows in the chosen format */
async function exportInFormat(
  title: string,
  rows: Record<string, unknown>[],
  columns: string[],
  filename: string,
  format: ExportFormat,
) {
  if (format === 'pdf') {
    toPdfPrint(title, rows, columns)
  } else if (format === 'docx') {
    const blob = await toDocxBlob(title, rows, columns)
    downloadBlob(blob, filename.replace(/\.xlsx$/, '.docx'))
  } else {
    const blob = await toXlsx(rows, title)
    downloadBlob(blob, filename)
  }
}

async function fetchExport<T>(designId: string, type: string): Promise<T> {
  const res = await fetch(`/api/org/designs/${designId}/export/${type}`, { method: 'POST' })
  if (!res.ok) throw new Error(`Export failed: ${res.status}`)
  return res.json() as Promise<T>
}

// ---- Public exports ----

export async function exportBom(designId: string, format: ExportFormat = 'xlsx'): Promise<void> {
  const data = await fetchExport<BomExport>(designId, 'bom')
  const columns = ['#', 'Category', 'Manufacturer', 'Model', 'Qty', 'Unit Cost', 'Total']
  const rows = data.items.map((item, i) => ({
    '#': i + 1,
    'Category': item.category,
    'Manufacturer': item.manufacturer,
    'Model': item.model,
    'Qty': item.qty,
    'Unit Cost': item.unitCost,
    'Total': item.qty * item.unitCost,
  }))
  await exportInFormat(`${data.designName} — BOM`, rows, columns, `${sanitizeFilename(data.designName)}_BOM.xlsx`, format)
}

export async function exportMaterialList(designId: string, format: ExportFormat = 'xlsx'): Promise<void> {
  const data = await fetchExport<MaterialExport>(designId, 'material-list')
  const columns = ['#', 'Label', 'Category', 'Status', 'Mount Type', 'Area', 'Manufacturer', 'Model', 'Part #']
  const rows = data.devices.map((d, i) => {
    const props = d.properties ?? {}
    return {
      '#': i + 1,
      'Label': d.label,
      'Category': d.category,
      'Status': d.status || 'planned',
      'Mount Type': d.mount_type || '',
      'Area': d.area_id || 'unassigned',
      'Manufacturer': String(props.manufacturer ?? ''),
      'Model': String(props.model ?? ''),
      'Part #': String(props.part_number ?? ''),
    }
  })
  await exportInFormat(`${data.designName} — Material List`, rows, columns, `${sanitizeFilename(data.designName)}_Material_List.xlsx`, format)
}

export async function exportHardwareSchedule(designId: string, format: ExportFormat = 'xlsx'): Promise<void> {
  const data = await fetchExport<HardwareExport>(designId, 'hardware-schedule')
  const columns = ['#', 'Area', 'Label', 'Category', 'Status', 'Mount Type', 'Manufacturer', 'Model', 'Part #']
  const rows: Record<string, unknown>[] = []
  let idx = 1
  for (const area of data.areas) {
    for (const d of area.devices) {
      const props = (d.properties ?? {}) as Record<string, unknown>
      rows.push({
        '#': idx++,
        'Area': (area as unknown as { areaName?: string }).areaName || area.areaId,
        'Label': d.label,
        'Category': d.category,
        'Status': d.status || 'planned',
        'Mount Type': d.mount_type || '',
        'Manufacturer': String(props.manufacturer ?? ''),
        'Model': String(props.model ?? ''),
        'Part #': String(props.part_number ?? ''),
      })
    }
  }
  await exportInFormat(`${data.designName} — Hardware Schedule`, rows, columns, `${sanitizeFilename(data.designName)}_Hardware_Schedule.xlsx`, format)
}

export async function exportCableSchedule(designId: string, format: ExportFormat = 'xlsx'): Promise<void> {
  const data = await fetchExport<CableExport>(designId, 'cable-schedule')
  const mdfMap = new Map(data.mdfIdfs.map((m) => [m.id, m.name]))
  const columns = ['#', 'Label', 'Cable Type', 'Length (ft)', 'Slack %', 'Total Length (ft)', 'Service Loop (ft)', 'MDF/IDF']
  const rows: Record<string, string | number | null>[] = data.cables.map((c, i) => ({
    '#': i + 1,
    'Label': c.label || '',
    'Cable Type': c.cable_type || 'cat6',
    'Length (ft)': c.length_ft ?? '',
    'Slack %': c.slack_pct ?? '',
    'Total Length (ft)': c.total_length_ft ?? '',
    'Service Loop (ft)': c.service_loop_ft ?? '',
    'MDF/IDF': c.mdf_idf_id ? (mdfMap.get(c.mdf_idf_id) ?? c.mdf_idf_id) : '',
  }))
  rows.push({
    '#': '', 'Label': 'TOTAL', 'Cable Type': '', 'Length (ft)': '', 'Slack %': '',
    'Total Length (ft)': data.totalFootage, 'Service Loop (ft)': '', 'MDF/IDF': '',
  })
  await exportInFormat(`${data.designName} — Cable Schedule`, rows, columns, `${sanitizeFilename(data.designName)}_Cable_Schedule.xlsx`, format)
}

export function exportCanvasSnapshot(
  dataUrl: string | null,
  designName: string,
): void {
  if (!dataUrl) return
  // Convert data URL to blob
  const parts = dataUrl.split(',')
  const mime = parts[0].match(/:(.*?);/)?.[1] ?? 'image/png'
  const raw = atob(parts[1])
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  const blob = new Blob([arr], { type: mime })
  downloadBlob(blob, `${sanitizeFilename(designName)}_Canvas.png`)
}

// ---- ISO 62676 Compliance (EN 62676-4 DORI requirements) ----

export interface IsoComplianceResult {
  deviceId: string
  label: string
  requiredDori: 'detection' | 'observation' | 'recognition' | 'identification'
  achievedDori: string
  ppf: number
  targetDistFt: number
  pass: boolean
  notes: string
}

const DORI_PPF_THRESHOLDS: Record<string, number> = {
  detection: DORI_THRESHOLDS.detection,
  observation: DORI_THRESHOLDS.observation,
  recognition: DORI_THRESHOLDS.recognition,
  identification: DORI_THRESHOLDS.identification,
}

export function checkIsoCompliance(
  devices: { id: string; label: string; category: string; properties: Record<string, unknown> | null }[],
  requirements: Record<string, 'detection' | 'observation' | 'recognition' | 'identification'>,
  calculatePpf: (d: { properties: Record<string, unknown> | null }) => number,
  classifyDori: (ppf: number) => string,
): IsoComplianceResult[] {
  const CAMERA_CATS = ['cctv', 'dome', 'bullet', 'turret', 'ptz', 'fisheye', 'multisensor_quad', 'multisensor_dual']
  return devices.filter(d => CAMERA_CATS.includes(d.category)).map(d => {
    const req = requirements[d.id] || 'detection'
    const ppf = calculatePpf(d)
    const achieved = classifyDori(ppf)
    const requiredPpf = DORI_PPF_THRESHOLDS[req] || 10
    const pass = ppf >= requiredPpf
    const p = (d.properties ?? {}) as Record<string, unknown>
    return {
      deviceId: d.id, label: d.label, requiredDori: req, achievedDori: achieved,
      ppf: Math.round(ppf), targetDistFt: (p.target_distance as number) || 30,
      pass, notes: pass ? '' : `Needs ${requiredPpf} PPF for ${req}, achieving ${Math.round(ppf)}`,
    }
  })
}

export async function exportIsoComplianceReport(
  designId: string,
  results: IsoComplianceResult[],
  designName: string,
): Promise<void> {
  const rows = results.map((r, i) => ({
    '#': i + 1,
    'Camera': r.label,
    'Required DORI': r.requiredDori.toUpperCase(),
    'Achieved DORI': r.achievedDori.toUpperCase(),
    'PPF': r.ppf,
    'Target Dist (ft)': r.targetDistFt,
    'Pass/Fail': r.pass ? 'PASS ✓' : 'FAIL ✗',
    'Notes': r.notes,
  }))
  const passCount = results.filter(r => r.pass).length
  rows.push({
    '#': '' as never,
    'Camera': `SUMMARY: ${passCount}/${results.length} cameras pass`,
    'Required DORI': '', 'Achieved DORI': '', 'PPF': '' as never,
    'Target Dist (ft)': '' as never,
    'Pass/Fail': passCount === results.length ? 'ALL PASS' : 'ISSUES FOUND',
    'Notes': '',
  })
  const blob = await toXlsx(rows, 'ISO 62676 Compliance')
  downloadBlob(blob, `${sanitizeFilename(designName)}_ISO_62676_Compliance.xlsx`)
}

// ---- BOM with Pricing & Proposals ----

export interface BomPricingConfig {
  laborRatePerHour: number
  markupPct: number
  taxRatePct: number
  defaultLaborHours: Record<string, number>
}

const DEFAULT_PRICING: BomPricingConfig = {
  laborRatePerHour: 85,
  markupPct: 30,
  taxRatePct: 8.25,
  defaultLaborHours: {
    cctv: 1.5, dome: 1.5, bullet: 1.5, turret: 1.5,
    ptz: 2.5, fisheye: 2.0,
    multisensor_quad: 3.0, multisensor_dual: 2.5,
    access_control: 2.0, door: 3.0,
    network: 1.0, switch: 0.5, nvr: 2.0,
    av: 1.5, speaker: 1.0,
    vape_environmental: 1.0, sensors: 0.75,
  },
}

export async function exportBomWithPricing(
  designId: string,
  pricing?: Partial<BomPricingConfig>,
): Promise<void> {
  const cfg = { ...DEFAULT_PRICING, ...pricing }
  const data = await fetchExport<BomExport>(designId, 'bom')

  const rows = data.items.map((item, i) => {
    const msrp = item.unitCost
    const dealerCost = msrp * 0.65
    const sellPrice = dealerCost * (1 + cfg.markupPct / 100)
    const laborHours = (cfg.defaultLaborHours[item.category] || 1) * item.qty
    return {
      '#': i + 1,
      'Category': item.category,
      'Manufacturer': item.manufacturer,
      'Model': item.model,
      'Qty': item.qty,
      'MSRP': msrp.toFixed(2),
      'Dealer Cost': dealerCost.toFixed(2),
      'Sell Price': sellPrice.toFixed(2),
      'Extended': (sellPrice * item.qty).toFixed(2),
      'Labor Hrs': laborHours.toFixed(1),
      'Labor Cost': (laborHours * cfg.laborRatePerHour).toFixed(2),
    }
  })

  const subtotalEquipment = rows.reduce((s, r) => s + parseFloat(String(r['Extended'])), 0)
  const subtotalLabor = rows.reduce((s, r) => s + parseFloat(String(r['Labor Cost'])), 0)
  const totalBeforeTax = subtotalEquipment + subtotalLabor
  const tax = totalBeforeTax * (cfg.taxRatePct / 100)
  const grandTotal = totalBeforeTax + tax

  rows.push(
    { '#': '' as never, 'Category': '', 'Manufacturer': '', 'Model': 'Subtotal Equipment', 'Qty': '' as never, 'MSRP': '', 'Dealer Cost': '', 'Sell Price': '', 'Extended': subtotalEquipment.toFixed(2), 'Labor Hrs': '', 'Labor Cost': '' },
    { '#': '' as never, 'Category': '', 'Manufacturer': '', 'Model': `Subtotal Labor ($${cfg.laborRatePerHour}/hr)`, 'Qty': '' as never, 'MSRP': '', 'Dealer Cost': '', 'Sell Price': '', 'Extended': '', 'Labor Hrs': '', 'Labor Cost': subtotalLabor.toFixed(2) },
    { '#': '' as never, 'Category': '', 'Manufacturer': '', 'Model': `Tax (${cfg.taxRatePct}%)`, 'Qty': '' as never, 'MSRP': '', 'Dealer Cost': '', 'Sell Price': '', 'Extended': tax.toFixed(2), 'Labor Hrs': '', 'Labor Cost': '' },
    { '#': '' as never, 'Category': '', 'Manufacturer': '', 'Model': 'GRAND TOTAL', 'Qty': '' as never, 'MSRP': '', 'Dealer Cost': '', 'Sell Price': '', 'Extended': grandTotal.toFixed(2), 'Labor Hrs': '', 'Labor Cost': '' },
  )

  const blob = await toXlsx(rows, 'BOM with Pricing')
  downloadBlob(blob, `${sanitizeFilename(data.designName)}_BOM_Pricing.xlsx`)
}
