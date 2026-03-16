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
    .from('device_import_batches')
    .select('*')
    .eq('org_id', dbUser.org_id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ batches: data ?? [] })
}
