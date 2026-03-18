import * as XLSX from 'xlsx'

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

function toXlsx(rows: Record<string, unknown>[], sheetName: string): Blob {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

async function fetchExport<T>(designId: string, type: string): Promise<T> {
  const res = await fetch(`/api/org/designs/${designId}/export/${type}`, { method: 'POST' })
  if (!res.ok) throw new Error(`Export failed: ${res.status}`)
  return res.json() as Promise<T>
}

// ---- Public exports ----

export async function exportBom(designId: string): Promise<void> {
  const data = await fetchExport<BomExport>(designId, 'bom')
  const rows = data.items.map((item, i) => ({
    '#': i + 1,
    'Category': item.category,
    'Manufacturer': item.manufacturer,
    'Model': item.model,
    'Qty': item.qty,
    'Unit Cost': item.unitCost,
    'Total': item.qty * item.unitCost,
  }))
  const blob = toXlsx(rows, 'BOM')
  downloadBlob(blob, `${sanitizeFilename(data.designName)}_BOM.xlsx`)
}

export async function exportMaterialList(designId: string): Promise<void> {
  const data = await fetchExport<MaterialExport>(designId, 'material-list')
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
  const blob = toXlsx(rows, 'Material List')
  downloadBlob(blob, `${sanitizeFilename(data.designName)}_Material_List.xlsx`)
}

export async function exportHardwareSchedule(designId: string): Promise<void> {
  const data = await fetchExport<HardwareExport>(designId, 'hardware-schedule')
  const rows: Record<string, unknown>[] = []
  let idx = 1
  for (const area of data.areas) {
    for (const d of area.devices) {
      const props = (d.properties ?? {}) as Record<string, unknown>
      rows.push({
        '#': idx++,
        'Area': area.areaId,
        'Label': d.label,
        'Category': d.category,
        'Status': d.status || 'planned',
        'Mount Type': d.mount_type || '',
        'Manufacturer': String(props.manufacturer ?? ''),
        'Model': String(props.model ?? ''),
        'Part #': String(props.part_number ?? ''),
        'Position X': d.position_x,
        'Position Y': d.position_y,
      })
    }
  }
  const blob = toXlsx(rows, 'Hardware Schedule')
  downloadBlob(blob, `${sanitizeFilename(data.designName)}_Hardware_Schedule.xlsx`)
}

export async function exportCableSchedule(designId: string): Promise<void> {
  const data = await fetchExport<CableExport>(designId, 'cable-schedule')
  const mdfMap = new Map(data.mdfIdfs.map((m) => [m.id, m.name]))
  const rows: Record<string, string | number | null>[] = data.cables.map((c, i) => ({
    '#': i + 1,
    'Label': c.label || '',
    'Cable Type': c.cable_type || 'cat6',
    'Length (ft)': c.length_ft ?? '',
    'Slack %': c.slack_pct ?? '',
    'Total Length (ft)': c.total_length_ft ?? '',
    'Service Loop (ft)': c.service_loop_ft ?? '',
    'From Device': c.from_device_id || '',
    'To Device': c.to_device_id || '',
    'MDF/IDF': c.mdf_idf_id ? (mdfMap.get(c.mdf_idf_id) ?? c.mdf_idf_id) : '',
  }))
  // Summary row
  rows.push({
    '#': '',
    'Label': 'TOTAL',
    'Cable Type': '',
    'Length (ft)': '',
    'Slack %': '',
    'Total Length (ft)': data.totalFootage,
    'Service Loop (ft)': '',
    'From Device': '',
    'To Device': '',
    'MDF/IDF': '',
  })
  const blob = toXlsx(rows, 'Cable Schedule')
  downloadBlob(blob, `${sanitizeFilename(data.designName)}_Cable_Schedule.xlsx`)
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
