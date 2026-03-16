import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyDeviceLibraryAccess } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const dbUser = await verifyDeviceLibraryAccess()
  if (!dbUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const deviceItemId = body.device_item_id as string
  if (!deviceItemId) {
    return NextResponse.json({ error: 'device_item_id required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify item exists and belongs to this org
  const { data: item } = await admin
    .from('device_library_items')
    .select('id, org_id')
    .eq('id', deviceItemId)
    .single()

  if (!item) {
    return NextResponse.json({ error: 'Device item not found' }, { status: 404 })
  }

  if (item.org_id !== dbUser.org_id) {
    return NextResponse.json({ error: 'Can only contribute org-owned items' }, { status: 403 })
  }

  // Check for existing pending contribution
  const { data: existing } = await admin
    .from('device_library_contributions')
    .select('id')
    .eq('device_item_id', deviceItemId)
    .eq('status', 'pending_review')
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'This item already has a pending contribution' }, { status: 409 })
  }

  // Create contribution
  const { data: contrib, error: contribErr } = await admin
    .from('device_library_contributions')
    .insert({
      org_id: dbUser.org_id,
      device_item_id: deviceItemId,
      submitted_by: dbUser.id,
      status: 'pending_review',
    })
    .select()
    .single()

  if (contribErr) {
    return NextResponse.json({ error: contribErr.message }, { status: 400 })
  }

  return NextResponse.json({ contribution: contrib }, { status: 201 })
}
