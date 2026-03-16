import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyDeviceLibraryAccess } from '@/lib/auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyDeviceLibraryAccess()
  if (!dbUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: batchId } = await params
  const admin = createAdminClient()

  // Verify batch belongs to org
  const { data: batch } = await admin
    .from('device_import_batches')
    .select('id, org_id')
    .eq('id', batchId)
    .single()

  if (!batch || batch.org_id !== dbUser.org_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: rows, error } = await admin
    .from('device_import_rows')
    .select('*')
    .eq('batch_id', batchId)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ rows: rows ?? [] })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyDeviceLibraryAccess()
  if (!dbUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: batchId } = await params
  const admin = createAdminClient()

  // Verify batch belongs to org
  const { data: batch } = await admin
    .from('device_import_batches')
    .select('id, org_id')
    .eq('id', batchId)
    .single()

  if (!batch || batch.org_id !== dbUser.org_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const rowIds = body.rowIds as string[]
  const action = body.action as string

  if (!rowIds || !Array.isArray(rowIds) || rowIds.length === 0) {
    return NextResponse.json({ error: 'rowIds array required' }, { status: 400 })
  }

  if (action !== 'approved' && action !== 'rejected') {
    return NextResponse.json({ error: 'action must be approved or rejected' }, { status: 400 })
  }

  const { error } = await admin
    .from('device_import_rows')
    .update({ status: action })
    .in('id', rowIds)
    .eq('batch_id', batchId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ updated: rowIds.length })
}
