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

  const { id } = await params
  const orgId = dbUser.org_id
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('device_library_items')
    .select('*')
    .eq('id', id)
    .or(`org_id.is.null,org_id.eq.${orgId}`)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ item: data })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyDeviceLibraryAccess()
  if (!dbUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const orgId = dbUser.org_id
  const admin = createAdminClient()

  // Only allow editing org-owned items
  const { data: existing } = await admin
    .from('device_library_items')
    .select('id, org_id')
    .eq('id', id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (existing.org_id !== orgId) {
    return NextResponse.json({ error: 'Cannot edit global or other org items' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Whitelist editable fields
  const allowed = [
    'vendor', 'model', 'partnumber', 'category', 'subcategory',
    'resolution', 'fps', 'poe_standard', 'wattage', 'ndaa_compliant',
    'specs', 'manufacturer_id',
  ]
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) {
      updates[key] = body[key]
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  updates.updated_at = new Date().toISOString()

  const { data, error } = await admin
    .from('device_library_items')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ item: data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyDeviceLibraryAccess()
  if (!dbUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const orgId = dbUser.org_id
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('device_library_items')
    .select('id, org_id')
    .eq('id', id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (existing.org_id !== orgId) {
    return NextResponse.json({ error: 'Cannot delete global or other org items' }, { status: 403 })
  }

  const { error: delErr } = await admin
    .from('device_library_items')
    .delete()
    .eq('id', id)

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 400 })
  }

  return NextResponse.json({ deleted: true })
}
