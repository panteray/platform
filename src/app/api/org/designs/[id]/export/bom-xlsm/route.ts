import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { verifyDesignAccess } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import * as XLSX from 'xlsx'

type Props = Record<string, unknown>

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_').substring(0, 60) || 'BOM'
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: designId } = await params
  const admin = createAdminClient()

  const { data: design } = await admin
    .from('designs')
    .select('id, name, opp_id')
    .eq('id', designId)
    .eq('org_id', user.org_id)
    .single()
  if (!design) return NextResponse.json({ error: 'Design not found' }, { status: 404 })

  let opp: {
    opp_number: string | null
    project_name: string | null
    system_name: string | null
    install_address: string | null
    state: string | null
    assigned_presales_id: string | null
    quote_number?: string | null
  } | null = null
  if (design.opp_id) {
    const { data } = await admin
      .from('opportunities')
      .select('opp_number, project_name, system_name, install_address, state, assigned_presales_id')
      .eq('id', design.opp_id)
      .single()
    opp = data
  }

  let engineerName = ''
  const engineerId = opp?.assigned_presales_id || user.id
  if (engineerId) {
    const { data: eng } = await admin
      .from('org_users')
      .select('full_name, email')
      .eq('id', engineerId)
      .single()
    engineerName = eng?.full_name || eng?.email || ''
  }

  const { data: devices } = await admin
    .from('design_devices')
    .select('category, label, properties')
    .eq('design_id', designId)
    .order('created_at')

  type Line = { qty: number; vendor: string; pn: string; description: string }
  const groups = new Map<string, Line>()
  for (const d of devices ?? []) {
    const props = (d.properties ?? {}) as Props
    const vendor = String(props.manufacturer ?? '')
    const pn = String(props.model ?? props.part_number ?? d.label ?? '')
    const desc = String(props.description ?? d.label ?? '')
    const key = `${vendor}|${pn}|${desc}`
    const existing = groups.get(key)
    if (existing) existing.qty++
    else groups.set(key, { qty: 1, vendor, pn, description: desc })
  }
  const lines = Array.from(groups.values()).sort((a, b) => {
    if (a.vendor !== b.vendor) return a.vendor.localeCompare(b.vendor)
    return a.pn.localeCompare(b.pn)
  })

  const templatePath = path.join(process.cwd(), 'src/app/api/org/designs/[id]/export/bom-xlsm/template.xlsm')
  const templateBuf = await fs.readFile(templatePath)

  const wb = XLSX.read(templateBuf, { type: 'buffer', bookVBA: true, cellStyles: true, cellFormula: true })
  const ws = wb.Sheets['Equipment']
  if (!ws) return NextResponse.json({ error: 'Template Equipment sheet missing' }, { status: 500 })

  const setCell = (addr: string, value: string | number | null) => {
    if (value === null || value === undefined || value === '') return
    const existing = ws[addr]
    ws[addr] = { ...(existing || {}), t: typeof value === 'number' ? 'n' : 's', v: value }
    delete ws[addr].f
  }

  setCell('C4', opp?.opp_number || '')
  setCell('C5', opp?.project_name || design.name || '')
  setCell('C6', opp?.system_name || '')
  setCell('C7', engineerName)
  setCell('C8', opp?.install_address || '')
  setCell('C9', opp?.state || '')
  setCell('K4', 'V1')
  setCell('K5', new Date().toISOString().slice(0, 10))

  const START_ROW = 20
  for (let i = 0; i < lines.length; i++) {
    const r = START_ROW + i
    const line = lines[i]
    setCell(`A${r}`, i + 1)
    setCell(`B${r}`, line.qty)
    setCell(`C${r}`, line.vendor)
    setCell(`E${r}`, line.pn)
    setCell(`F${r}`, line.description)
  }

  const lastRow = START_ROW + Math.max(lines.length, 5) - 1
  const currentRange = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : { s: { r: 0, c: 0 }, e: { r: lastRow, c: 10 } }
  currentRange.e.r = Math.max(currentRange.e.r, lastRow)
  currentRange.e.c = Math.max(currentRange.e.c, 10)
  ws['!ref'] = XLSX.utils.encode_range(currentRange)

  const out = XLSX.write(wb, { bookType: 'xlsm', type: 'buffer', bookVBA: true, compression: true })

  const filename = `${sanitizeFilename(opp?.opp_number || design.name)}_BOM.xlsm`

  return new NextResponse(out, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.ms-excel.sheet.macroEnabled.12',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
