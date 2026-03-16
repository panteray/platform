import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyDeviceLibraryAccess } from '@/lib/auth'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyDeviceLibraryAccess()
  if (!dbUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: batchId } = await params
  const orgId = dbUser.org_id
  const admin = createAdminClient()

  // Verify batch belongs to org and is in parsed state
  const { data: batch } = await admin
    .from('device_import_batches')
    .select('id, org_id, status, vendor')
    .eq('id', batchId)
    .single()

  if (!batch || batch.org_id !== orgId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (batch.status === 'committed') {
    return NextResponse.json({ error: 'Batch already committed' }, { status: 400 })
  }

  // Get approved rows
  const { data: approvedRows, error: rowErr } = await admin
    .from('device_import_rows')
    .select('*')
    .eq('batch_id', batchId)
    .eq('status', 'approved')

  if (rowErr) {
    return NextResponse.json({ error: rowErr.message }, { status: 400 })
  }

  if (!approvedRows || approvedRows.length === 0) {
    return NextResponse.json({ error: 'No approved rows to commit' }, { status: 400 })
  }

  // Insert into device_library_items
  const inserts = approvedRows.map((row) => ({
    org_id: orgId,
    vendor: row.vendor ?? batch.vendor ?? 'Unknown',
    model: row.model ?? row.partnumber ?? 'Unknown',
    partnumber: row.partnumber,
    category: row.category ?? 'other',
    subcategory: row.subcategory,
    resolution: row.resolution,
    fps: row.fps,
    poe_standard: row.poe_standard,
    wattage: row.wattage,
    ndaa_compliant: row.ndaa_compliant ?? false,
    specs: {},
  }))

  const { error: insertErr } = await admin
    .from('device_library_items')
    .insert(inserts)

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 400 })
  }

  // Mark rows as committed
  const approvedIds = approvedRows.map((r) => r.id)
  await admin
    .from('device_import_rows')
    .update({ status: 'committed' })
    .in('id', approvedIds)

  // Update batch status + approved count
  await admin
    .from('device_import_batches')
    .update({
      status: 'committed',
      approved_rows: approvedRows.length,
      updated_at: new Date().toISOString(),
    })
    .eq('id', batchId)

  return NextResponse.json({
    committed: approvedRows.length,
    total: approvedRows.length,
  })
}
