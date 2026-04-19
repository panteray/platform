import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyDeviceLibraryAccess, canWriteDeviceLibrary } from '@/lib/auth'
import { parseSpreadsheetRows } from '@/lib/device-import-parser'
import type { ParsedImportRow } from '@/lib/device-import-parser'
import * as XLSX from 'xlsx'

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB

function getFileType(fileName: string): 'pdf' | 'xlsx' | 'csv' | null {
  const ext = fileName.toLowerCase().split('.').pop()
  if (ext === 'pdf') return 'pdf'
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx'
  if (ext === 'csv') return 'csv'
  return null
}

function parseExcel(buffer: Buffer, vendor: string | null): ParsedImportRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const allRows: ParsedImportRow[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
    if (jsonData.length === 0) continue

    const headers = Object.keys(jsonData[0])
    const parsed = parseSpreadsheetRows(headers, jsonData, vendor)
    allRows.push(...parsed)
  }

  return allRows
}

function parseCsv(buffer: Buffer, vendor: string | null): ParsedImportRow[] {
  // Decode to string and strip UTF-8 BOM — Excel on Windows adds BOM to CSV exports
  const text = buffer.toString('utf-8').replace(/^\uFEFF/, '')
  const workbook = XLSX.read(text, { type: 'string' })

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []

  const sheet = workbook.Sheets[sheetName]
  const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  if (jsonData.length === 0) return []

  // Filter out empty/whitespace-only headers that XLSX can generate from trailing delimiters
  const headers = Object.keys(jsonData[0]).filter((h) => h.trim() && !h.startsWith('__EMPTY'))
  return parseSpreadsheetRows(headers, jsonData, vendor)
}

export async function POST(req: NextRequest) {
  try {
    const dbUser = await verifyDeviceLibraryAccess()
    if (!dbUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!canWriteDeviceLibrary(dbUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const orgId = dbUser.org_id
    const admin = createAdminClient()

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const vendor = (formData.get('vendor') as string)?.trim() || null

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File exceeds 25MB limit' }, { status: 400 })
    }

    const fileType = getFileType(file.name)
    if (!fileType) {
      return NextResponse.json(
        { error: 'Unsupported file type. Accepted: .pdf, .xlsx, .xls, .csv' },
        { status: 400 }
      )
    }

    if (fileType === 'pdf') {
      return NextResponse.json(
        { error: 'PDF import is not supported. Please use CSV or Excel format.' },
        { status: 400 }
      )
    }

    // Parse file
    const buffer = Buffer.from(await file.arrayBuffer())
    let parsedRows: ParsedImportRow[]

    try {
      if (fileType === 'xlsx') {
        parsedRows = parseExcel(buffer, vendor)
      } else {
        parsedRows = parseCsv(buffer, vendor)
      }
    } catch (err) {
      return NextResponse.json(
        { error: `Failed to parse ${fileType.toUpperCase()} file: ${err instanceof Error ? err.message : 'Unknown error'}` },
        { status: 400 }
      )
    }

    if (parsedRows.length === 0) {
      return NextResponse.json(
        { error: 'No valid rows found in file. Ensure it has columns like partnumber, model, vendor, category.' },
        { status: 400 }
      )
    }

    // Duplicate guard: check for existing items with matching vendor+model or vendor+partnumber
    const { data: existing } = await admin
      .from('device_library_items')
      .select('vendor, model, partnumber')
      .eq('org_id', orgId)

    const existingKeys = new Set<string>()
    for (const row of existing ?? []) {
      const v = (row.vendor ?? '').toLowerCase().trim()
      if (row.model) existingKeys.add(`${v}::m::${row.model.toLowerCase().trim()}`)
      if (row.partnumber) existingKeys.add(`${v}::p::${row.partnumber.toLowerCase().trim()}`)
    }

    const newRows: ParsedImportRow[] = []
    const seenKeys = new Set<string>()
    let skipped = 0
    for (const row of parsedRows) {
      const v = (row.vendor ?? vendor ?? 'Unknown').toLowerCase().trim()
      const m = (row.model || row.partnumber || '').toLowerCase().trim()
      const p = (row.partnumber || '').toLowerCase().trim()
      const mKey = m ? `${v}::m::${m}` : ''
      const pKey = p ? `${v}::p::${p}` : ''
      const isDupeExisting =
        (mKey && existingKeys.has(mKey)) ||
        (pKey && existingKeys.has(pKey))
      const isDupeInBatch =
        (mKey && seenKeys.has(mKey)) ||
        (pKey && seenKeys.has(pKey))
      if (isDupeExisting || isDupeInBatch) {
        skipped++
      } else {
        if (mKey) seenKeys.add(mKey)
        if (pKey) seenKeys.add(pKey)
        newRows.push(row)
      }
    }

    if (newRows.length === 0) {
      return NextResponse.json(
        { imported: 0, skipped, fileName: file.name },
        { status: 200 }
      )
    }

    // Insert non-duplicate rows
    const inserts = newRows.map((row) => ({
      org_id: orgId,
      vendor: row.vendor ?? vendor ?? 'Unknown',
      model: row.model || row.partnumber,
      partnumber: row.partnumber || null,
      category: row.category ?? 'other',
      subcategory: row.subcategory || null,
      resolution: row.resolution || null,
      fps: row.fps || null,
      poe_standard: row.poe_standard || null,
      wattage: row.wattage ?? null,
      ndaa_compliant: row.ndaa_compliant ?? false,
      form: row.form || null,
      ir: row.ir || null,
      super_low_light: row.super_low_light ?? null,
      focal_length: row.focal_length || null,
      focal_type: row.focal_type || null,
      aov: row.aov || null,
      imager_count: row.imager_count ?? null,
      multi_imager_type: row.multi_imager_type || null,
      codecs: row.codecs || null,
      fisheye_view: row.fisheye_view || null,
      environment: row.environment || null,
      specs: row.specs ?? {},
    }))

    const { error: insertErr } = await admin
      .from('device_library_items')
      .insert(inserts)

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 400 })
    }

    return NextResponse.json(
      { imported: inserts.length, skipped, fileName: file.name },
      { status: 201 }
    )
  } catch (err) {
    console.error('[device-import] unhandled error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
