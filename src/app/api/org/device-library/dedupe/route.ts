import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyDeviceLibraryAccess } from '@/lib/auth'

export async function DELETE() {
  const dbUser = await verifyDeviceLibraryAccess()
  if (!dbUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = dbUser.org_id
  const admin = createAdminClient()

  // Fetch all items visible to this org
  const { data, error } = await admin
    .from('device_library_items')
    .select('id, vendor, model, partnumber, org_id, created_at')
    .or(`org_id.is.null,org_id.eq.${orgId}`)
    .order('created_at', { ascending: false })
    .limit(50000)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ deleted: 0 })
  }

  // Group by (vendor_lower, model_lower, org_id) — keep newest (first in list since sorted desc)
  const seen = new Map<string, string>() // key → kept id
  const dupeIds: string[] = []

  for (const row of data) {
    const v = (row.vendor ?? '').toLowerCase().trim()
    const m = (row.model ?? '').toLowerCase().trim()
    const o = row.org_id ?? 'global'
    const key = `${v}::${m}::${o}`

    if (seen.has(key)) {
      dupeIds.push(row.id)
    } else {
      seen.set(key, row.id)
    }
  }

  if (dupeIds.length === 0) {
    return NextResponse.json({ deleted: 0 })
  }

  // Delete in batches of 100
  let deleted = 0
  for (let i = 0; i < dupeIds.length; i += 100) {
    const batch = dupeIds.slice(i, i + 100)
    const { error: delErr } = await admin
      .from('device_library_items')
      .delete()
      .in('id', batch)

    if (!delErr) {
      deleted += batch.length
    }
  }

  return NextResponse.json({ deleted })
}
