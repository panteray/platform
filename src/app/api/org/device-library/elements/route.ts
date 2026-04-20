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
    .from('device_elements')
    .select('id, name, category, color_hex, attribute_schema, description, is_active')
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ elements: data ?? [] })
}
