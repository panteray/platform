import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyDeviceLibraryAccess } from '@/lib/auth'

export async function GET() {
  const dbUser = await verifyDeviceLibraryAccess()
  if (!dbUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('device_library_items')
    .select('vendor')
    .or(`org_id.is.null,org_id.eq.${dbUser.org_id}`)
    .order('vendor', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Extract distinct vendor names
  const vendors = [...new Set((data ?? []).map((r) => r.vendor).filter(Boolean))]

  return NextResponse.json({ manufacturers: vendors })
}
