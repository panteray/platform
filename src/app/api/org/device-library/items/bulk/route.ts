import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyDeviceLibraryAccess, canWriteDeviceLibrary } from '@/lib/auth'

const ALLOWED_BULK_FIELDS = new Set([
  'category', 'subcategory', 'form', 'ndaa_compliant', 'ul_listed', 'ul_listing_code',
  'environment', 'poe_standard',
])

function canModify(
  row: { org_id: string | null },
  orgId: string,
  isAdmin: boolean,
): boolean {
  if (row.org_id === orgId) return true
  if (row.org_id === null && isAdmin) return true
  return false
}

export async function PATCH(req: NextRequest) {
  const dbUser = await verifyDeviceLibraryAccess()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWriteDeviceLibrary(dbUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { ids?: string[]; updates?: Record<string, unknown> }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const ids = (body.ids ?? []).filter(x => typeof x === 'string')
  const updates = body.updates ?? {}
  if (ids.length === 0) return NextResponse.json({ error: 'No ids' }, { status: 400 })

  const filtered: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(updates)) {
    if (ALLOWED_BULK_FIELDS.has(k)) filtered[k] = v
  }
  if (Object.keys(filtered).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
  }
  filtered.updated_at = new Date().toISOString()

  const admin = createAdminClient()
  const isAdmin = dbUser.role === 'GLOBAL_ADMIN' || dbUser.role === 'ORG_ADMIN' || dbUser.is_global_admin

  const { data: rows } = await admin
    .from('device_library_items')
    .select('id, org_id')
    .in('id', ids)

  const allowedIds = (rows ?? []).filter(r => canModify(r, dbUser.org_id, isAdmin)).map(r => r.id)
  if (allowedIds.length === 0) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await admin
    .from('device_library_items')
    .update(filtered)
    .in('id', allowedIds)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ updated: allowedIds.length, skipped: ids.length - allowedIds.length })
}

export async function DELETE(req: NextRequest) {
  const dbUser = await verifyDeviceLibraryAccess()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWriteDeviceLibrary(dbUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { ids?: string[] }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const ids = (body.ids ?? []).filter(x => typeof x === 'string')
  if (ids.length === 0) return NextResponse.json({ error: 'No ids' }, { status: 400 })

  const admin = createAdminClient()
  const isAdmin = dbUser.role === 'GLOBAL_ADMIN' || dbUser.role === 'ORG_ADMIN' || dbUser.is_global_admin

  const { data: rows } = await admin
    .from('device_library_items')
    .select('id, org_id')
    .in('id', ids)

  const allowedIds = (rows ?? []).filter(r => canModify(r, dbUser.org_id, isAdmin)).map(r => r.id)
  if (allowedIds.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await admin
    .from('device_library_items')
    .delete()
    .in('id', allowedIds)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ deleted: allowedIds.length, skipped: ids.length - allowedIds.length })
}
