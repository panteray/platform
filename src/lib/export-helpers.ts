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
  areaName?: string
  satellite_lat?: number | null
  satellite_lng?: number | null
  satellite_zoom?: number
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

export type ExportFormat = 'xlsx' | 'xlsm' | 'pdf' | 'docx'

function sanitizeSheetName(name: string): string {
  return name.replace(/[:\\/?*[\]]/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 31) || 'Sheet1'
}

async function toXlsx(rows: Record<string, unknown>[], sheetName: string): Promise<Blob> {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(sheetName))
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
  if (w) {
    w.document.write(html)
    w.document.close()
    w.onload = () => {
      const imgs = Array.from(w.document.images)
      if (imgs.length === 0) { w.print(); return }
      let remaining = imgs.length
      const done = () => { if (--remaining <= 0) w.print() }
      imgs.forEach(img => {
        if (img.complete) done()
        else { img.onload = done; img.onerror = done }
      })
    }
  }
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
export async function exportInFormat(
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

export async function exportBomTemplate(designId: string): Promise<void> {
  const res = await fetch(`/api/org/designs/${designId}/export/bom-xlsm`, { method: 'POST' })
  if (!res.ok) throw new Error(`BOM template export failed: ${res.status}`)
  const blob = await res.blob()
  const disp = res.headers.get('Content-Disposition') || ''
  const m = disp.match(/filename="([^"]+)"/)
  const filename = m?.[1] || 'BOM.xlsm'
  downloadBlob(blob, filename)
}

export async function exportBom(designId: string, format: ExportFormat = 'xlsx'): Promise<void> {
  if (format === 'xlsm') return exportBomTemplate(designId)
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

  // For XLSX fallback — simple table
  if (format === 'xlsx') {
    const columns = ['#', 'Area', 'Label', 'Category', 'Status', 'Mount Type', 'Manufacturer', 'Model', 'Part #']
    const rows: Record<string, unknown>[] = []
    let idx = 1
    for (const area of data.areas) {
      for (const d of area.devices) {
        const props = (d.properties ?? {}) as Record<string, unknown>
        rows.push({ '#': idx++, 'Area': (area as unknown as { areaName?: string }).areaName || area.areaId, 'Label': d.label, 'Category': d.category, 'Status': d.status || 'planned', 'Mount Type': d.mount_type || '', 'Manufacturer': String(props.manufacturer ?? ''), 'Model': String(props.model ?? ''), 'Part #': String(props.part_number ?? '') })
      }
    }
    await exportInFormat(`${data.designName} — Hardware Schedule`, rows, columns, `${sanitizeFilename(data.designName)}_Hardware_Schedule.xlsx`, 'xlsx')
    return
  }

  // For PDF — server-side render via puppeteer-core + @sparticuz/chromium
  if (format === 'pdf') {
    const res = await fetch(`/api/org/designs/${designId}/export/hardware-schedule-pdf`, { method: 'POST' })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'PDF generation failed' }))
      throw new Error(err.detail || err.error || 'PDF generation failed')
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${sanitizeFilename(data.designName)}_Hardware_Schedule.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return
  }


  // For DOCX — per-device panel document
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, WidthType, BorderStyle, ShadingType, PageBreak } = await import('docx')
  const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }
  const borders = { top: border, bottom: border, left: border, right: border }
  const margins = { top: 50, bottom: 50, left: 80, right: 80 }
  const p = (text: string, opts?: { bold?: boolean; size?: number; color?: string; font?: string }) =>
    new Paragraph({ children: [new TextRun({ text, font: opts?.font || 'Arial', size: opts?.size || 20, bold: opts?.bold, color: opts?.color })] })

  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [
    // Cover
    p(''), p(''), p(''),
    new Paragraph({ alignment: 'center' as never, children: [new TextRun({ text: 'Howard Technology Solutions', font: 'Arial', size: 18, color: '888888' })] }),
    p(''),
    new Paragraph({ alignment: 'center' as never, children: [new TextRun({ text: data.designName, font: 'Arial', size: 48, bold: true, color: '522F82' })] }),
    new Paragraph({ alignment: 'center' as never, children: [new TextRun({ text: 'Hardware Schedule', font: 'Arial', size: 28, color: '666666' })] }),
    p(''),
    new Paragraph({ alignment: 'center' as never, children: [new TextRun({ text: `Generated ${new Date().toLocaleDateString()}`, font: 'Arial', size: 22, color: 'CC3333' })] }),
    new Paragraph({ alignment: 'center' as never, children: [new TextRun({ text: `${data.totalDevices} devices across ${data.areas.length} area(s)`, font: 'Arial', size: 20, color: '888888' })] }),
    new Paragraph({ children: [new PageBreak()] }),
  ]

  // Fetch Maps API key for static map images in DOCX
  let docxMapsKey = ''
  try {
    const keyRes = await fetch('/api/org/maps-key')
    if (keyRes.ok) { const kd = await keyRes.json(); docxMapsKey = kd.key || '' }
  } catch { /* no map images */ }

  // Per-area sections with per-device panels
  for (const area of data.areas) {
    const areaName = area.areaName || area.areaId
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: areaName, font: 'Arial' })] }))
    children.push(p(`${area.devices.length} device(s) in this area`, { size: 18, color: '888888' }))

    // Embed static map image if satellite coords available
    if (docxMapsKey && area.satellite_lat && area.satellite_lng) {
      try {
        const { ImageRun } = await import('docx')
        const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${area.satellite_lat},${area.satellite_lng}&zoom=${area.satellite_zoom || 18}&size=800x400&maptype=satellite&key=${docxMapsKey}`
        const imgRes = await fetch(mapUrl)
        if (imgRes.ok) {
          const imgBuf = await imgRes.arrayBuffer()
          children.push(new Paragraph({ children: [new ImageRun({
            type: 'png', data: new Uint8Array(imgBuf),
            transformation: { width: 600, height: 300 },
            altText: { title: `${areaName} Map`, description: 'Satellite map of area', name: 'area-map' },
          })] }))
        }
      } catch { /* skip map image on error */ }
    }
    children.push(p(''))

    for (const d of area.devices) {
      const props = (d.properties ?? {}) as Record<string, unknown>
      const vendor = String(props.manufacturer || props.vendor || '—')
      const model = String(props.model || '—')
      const pn = String(props.partnumber || props.part_number || '—')
      const mountType = d.mount_type || String(props.mount_type || '—')
      const installHt = Number(props.install_height) || 0
      const env = String(props.environment || '—')
      const cableType = String(props.cable_type || 'Cat6')
      const ipAddr = String(props.ip_address || '—')
      const notes = String(props.device_notes || props.notes || '')
      const liftReq = installHt > 12

      // Device header
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [
        new TextRun({ text: `${d.label || 'Device'} — ${vendor} ${model}`, font: 'Arial' }),
        ...(liftReq ? [new TextRun({ text: '  ⚠ LIFT REQUIRED', font: 'Arial', size: 18, color: 'EF4444', bold: true })] : []),
      ] }))

      // Device specs table
      const specRows = [
        ['Manufacturer', vendor, 'Model', model],
        ['Part Number', pn, 'Category', d.category.replace(/_/g, ' ')],
        ['Mount Type', mountType, 'Install Height', installHt > 0 ? `${installHt} ft` : '—'],
        ['Environment', env, 'Cable Type', cableType],
        ['IP Address', ipAddr, 'Status', d.status || 'planned'],
      ]

      const colWidths = [1800, 2880, 1800, 2880]
      children.push(new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: colWidths,
        rows: specRows.map(row => new TableRow({
          children: row.map((cell, ci) => new TableCell({
            borders, width: { size: colWidths[ci], type: WidthType.DXA }, margins,
            shading: ci % 2 === 0 ? { fill: 'F0F0F0', type: ShadingType.CLEAR } : undefined,
            children: [new Paragraph({ children: [new TextRun({ text: cell, font: 'Arial', size: ci % 2 === 0 ? 16 : 18, bold: ci % 2 === 0, color: ci % 2 === 0 ? '888888' : '333333' })] })],
          })),
        })),
      }))

      if (notes) {
        children.push(p(''))
        children.push(p(`Notes: ${notes}`, { size: 18, color: '666666' }))
      }
      children.push(p(''))
    }

    children.push(new Paragraph({ children: [new PageBreak()] }))
  }

  // Material list
  children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'Material List', font: 'Arial' })] }))
  const matColWidths = [2000, 1800, 2200, 1800, 1560]
  const matHeaders = ['Label', 'Manufacturer', 'Model', 'Part #', 'Category']
  children.push(new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: matColWidths,
    rows: [
      new TableRow({ children: matHeaders.map((h, hi) => new TableCell({
        borders, width: { size: matColWidths[hi], type: WidthType.DXA }, margins,
        shading: { fill: 'E8E8E8', type: ShadingType.CLEAR },
        children: [new Paragraph({ children: [new TextRun({ text: h, font: 'Arial', size: 16, bold: true })] })],
      })) }),
      ...data.areas.flatMap(a => a.devices.map(d => {
        const pr = (d.properties ?? {}) as Record<string, unknown>
        return new TableRow({ children: [d.label, String(pr.manufacturer || '—'), String(pr.model || '—'), String(pr.partnumber || pr.part_number || '—'), d.category.replace(/_/g, ' ')].map((cell, ci) => new TableCell({
          borders, width: { size: matColWidths[ci], type: WidthType.DXA }, margins,
          children: [new Paragraph({ children: [new TextRun({ text: cell, font: 'Arial', size: 18 })] })],
        })) })
      })),
    ],
  }))

  const doc = new Document({
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children,
    }],
  })
  const blob = await Packer.toBlob(doc)
  downloadBlob(blob, `${sanitizeFilename(data.designName)}_Hardware_Schedule.docx`)
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
    servers_nvr: 2.0,
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

// ---- Field Installation Manual ----

export async function exportFieldManual(designId: string): Promise<void> {
  const [bomData, hwData, cableData] = await Promise.all([
    fetchExport<BomExport>(designId, 'bom'),
    fetchExport<HardwareExport>(designId, 'hardware-schedule'),
    fetchExport<CableExport>(designId, 'cable-schedule'),
  ])

  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, WidthType, BorderStyle, ShadingType, PageBreak } = await import('docx')
  const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }
  const borders = { top: border, bottom: border, left: border, right: border }
  const cellMargins = { top: 60, bottom: 60, left: 80, right: 80 }
  const h = (text: string, level: typeof HeadingLevel[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1) =>
    new Paragraph({ heading: level, children: [new TextRun({ text, font: 'Arial' })] })
  const p = (text: string, bold = false) =>
    new Paragraph({ children: [new TextRun({ text, font: 'Arial', size: 20, bold })] })

  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [
    h(`Field Installation Manual — ${bomData.designName}`),
    p(`Generated ${new Date().toLocaleDateString()}`),
    p(''),
    h('1. Equipment Summary', HeadingLevel.HEADING_2),
  ]

  // BOM table
  const bomCols = ['Qty', 'Manufacturer', 'Model']
  children.push(new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1500, 3930, 3930],
    rows: [
      new TableRow({ children: bomCols.map(c => new TableCell({ borders, width: { size: c === 'Qty' ? 1500 : 3930, type: WidthType.DXA }, shading: { fill: 'E8E8E8', type: ShadingType.CLEAR }, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: c, bold: true, font: 'Arial', size: 18 })] })] })) }),
      ...bomData.items.map(item => new TableRow({ children: [
        new TableCell({ borders, width: { size: 1500, type: WidthType.DXA }, margins: cellMargins, children: [p(String(item.qty))] }),
        new TableCell({ borders, width: { size: 3930, type: WidthType.DXA }, margins: cellMargins, children: [p(item.manufacturer)] }),
        new TableCell({ borders, width: { size: 3930, type: WidthType.DXA }, margins: cellMargins, children: [p(item.model)] }),
      ] })),
    ],
  }))

  // Per-area install instructions
  children.push(new Paragraph({ children: [new PageBreak()] }))
  children.push(h('2. Installation by Area', HeadingLevel.HEADING_2))

  for (const area of hwData.areas) {
    const areaName = (area as unknown as { areaName?: string }).areaName || area.areaId
    children.push(h(areaName, HeadingLevel.HEADING_3))
    children.push(p(`${area.devices.length} device(s) in this area`))
    for (const d of area.devices) {
      const props = (d.properties ?? {}) as Record<string, unknown>
      children.push(p(`• ${d.label} — ${String(props.manufacturer || '')} ${String(props.model || '')}`, true))
      children.push(p(`  Mount: ${d.mount_type || 'TBD'} | Category: ${d.category}`))
      if (Number(props.install_height) > 0) children.push(p(`  Install height: ${props.install_height}ft${Number(props.install_height) > 12 ? ' ⚠ LIFT REQUIRED' : ''}`))
    }
  }

  // Cable schedule
  children.push(new Paragraph({ children: [new PageBreak()] }))
  children.push(h('3. Cable Schedule', HeadingLevel.HEADING_2))
  children.push(p(`${cableData.cables.length} cable runs — ${cableData.totalFootage} ft total`))

  const mdfMap = new Map(cableData.mdfIdfs.map(m => [m.id, m.name]))
  for (const c of cableData.cables) {
    const mdfName = c.mdf_idf_id ? (mdfMap.get(c.mdf_idf_id) ?? 'Unknown') : '—'
    children.push(p(`• ${c.cable_type || 'Cat6'} — ${c.length_ft ?? 0}ft — MDF: ${mdfName}`))
  }

  // Quality checklist
  children.push(new Paragraph({ children: [new PageBreak()] }))
  children.push(h('4. Quality Checklist', HeadingLevel.HEADING_2))
  const checklist = [
    'All devices installed per approved hardware schedule',
    'Mounting height and positioning verified',
    'Devices properly secured and aligned',
    'All penetrations sealed and protected',
    'Cable properly supported and labeled at both ends',
    'All cables tested for continuity',
    'Devices powered on and verified operational',
    'Live view / data stream confirmed',
    'Work area cleaned and debris removed',
    'Customer/PM sign-off obtained',
  ]
  for (const item of checklist) {
    children.push(p(`☐ ${item}`))
  }

  const doc = new Document({
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children,
    }],
  })
  const blob = await Packer.toBlob(doc)
  downloadBlob(blob, `${sanitizeFilename(bomData.designName)}_Field_Manual.docx`)
}
