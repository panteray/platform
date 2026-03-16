import { NextRequest, NextResponse } from 'next/server'
import { verifyDesignAccess } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; avId: string }> }
) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: designId, avId: itemId } = await params
  const admin = createAdminClient()

  const { data, error } = await admin.from('design_avoip_devices').select('*').eq('id', itemId).eq('design_id', designId).single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ avoipDevice: data })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; avId: string }> }
) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: designId, avId: itemId } = await params
  const body = await request.json()
  const admin = createAdminClient()

  const allowed: Record<string, unknown> = {}
  for (const f of ['area_id','device_type','label','ip_address','signal_type','input_count','output_count','position_x','position_y','properties','device_id']) {
    if (body[f] !== undefined) allowed[f] = body[f]
  }
  if (Object.keys(allowed).length === 0) return NextResponse.json({ error: 'No updatable fields' }, { status: 400 })
  allowed.updated_at = new Date().toISOString()

  const { data, error } = await admin.from('design_avoip_devices').update(allowed).eq('id', itemId).eq('design_id', designId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ avoipDevice: data })
}
