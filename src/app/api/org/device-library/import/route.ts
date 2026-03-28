import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyDeviceLibraryAccess } from '@/lib/auth'
import { parsePdfText, parseSpreadsheetRows } from '@/lib/device-import-parser'
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

async function parsePdf(buffer: Buffer, vendor: string | null): Promise<ParsedImportRow[]> {
  const pdfParse = (await import('pdf-parse')).default
  const result = await pdfParse(buffer)
  return parsePdfText(result.text, vendor)
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
  // Decode to string and strip UTF-8 BOM — Excel on Windows adds BOM to CSV exports,
  // which XLSX.read({ type: 'buffer' }) reads as literal chars in the first header name
  const text = buffer.toString('utf-8').replace(/^\uFEFF/, '')
  const workbook = XLSX.read(text, { type: 'string' })

  // CSV loads as single sheet
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

    // Parse file
    const buffer = Buffer.from(await file.arrayBuffer())
    let parsedRows: ParsedImportRow[]

    try {
      if (fileType === 'pdf') {
        parsedRows = await parsePdf(buffer, vendor)
      } else if (fileType === 'xlsx') {
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

    // Create batch record
    const { data: batch, error: batchErr } = await admin
      .from('device_import_batches')
      .insert({
        org_id: orgId,
        file_name: file.name,
        file_type: fileType,
        vendor: vendor,
        status: 'parsed',
        total_rows: parsedRows.length,
        created_by: dbUser.id,
      })
      .select()
      .single()

    if (batchErr) {
      return NextResponse.json({ error: batchErr.message }, { status: 400 })
    }

    // Insert parsed rows
    if (parsedRows.length > 0) {
      const rowInserts = parsedRows.map((r) => ({
        batch_id: batch.id,
        raw_line: r.raw_line,
        partnumber: r.partnumber,
        vendor: r.vendor,
        model: r.model,
        category: r.category,
        subcategory: r.subcategory,
        resolution: r.resolution,
        fps: r.fps,
        poe_standard: r.poe_standard,
        wattage: r.wattage,
        ndaa_compliant: r.ndaa_compliant,
        confidence: Math.round(r.confidence * 100),
        status: 'pending',
      }))

      const { error: rowErr } = await admin
        .from('device_import_rows')
        .insert(rowInserts)

      if (rowErr) {
        return NextResponse.json({ error: rowErr.message }, { status: 400 })
      }
    }

    return NextResponse.json(
      { batchId: batch.id, fileType, totalRows: parsedRows.length },
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
