import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyDeviceLibraryAccess } from '@/lib/auth'

export async function GET() {
  const dbUser = await verifyDeviceLibraryAccess()
  if (!dbUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('device_library_manufacturers')
    .select('*')
    .or(`org_id.is.null,org_id.eq.${dbUser.org_id}`)
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ manufacturers: data ?? [] })
}

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

  const name = (body.name as string)?.trim()
  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const insert: Record<string, unknown> = {
    org_id: dbUser.org_id,
    name,
    ndaa_status: body.ndaa_status ?? 'unverified',
    ndaa_notes: body.ndaa_notes ?? null,
    website: body.website ?? null,
    is_active: body.is_active ?? true,
    created_by: dbUser.id,
  }

  const { data, error } = await admin
    .from('device_library_manufacturers')
    .insert(insert)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ manufacturer: data }, { status: 201 })
}
