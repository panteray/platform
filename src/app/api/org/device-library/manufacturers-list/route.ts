import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyDeviceLibraryAccess } from '@/lib/auth'

export async function GET() {
  const dbUser = await verifyDeviceLibraryAccess()
  if (!dbUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const vendors = new Set<string>()

  // Paginate through all rows — Supabase caps at 1000 per request
  let offset = 0
  const batchSize = 1000
  while (true) {
    const { data, error } = await admin
      .from('device_library_items')
      .select('vendor')
      .or(`org_id.is.null,org_id.eq.${dbUser.org_id}`)
      .order('vendor', { ascending: true })
      .range(offset, offset + batchSize - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (!data || data.length === 0) break

    for (const row of data) {
      if (row.vendor) vendors.add(row.vendor)
    }

    if (data.length < batchSize) break
    offset += batchSize
  }

  return NextResponse.json({ manufacturers: [...vendors].sort() })
}
