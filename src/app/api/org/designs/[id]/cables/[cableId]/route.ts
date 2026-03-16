import { NextRequest, NextResponse } from 'next/server'
import { verifyDesignAccess } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; cableId: string }> }
) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: designId, cableId: itemId } = await params
  const admin = createAdminClient()

  const { data, error } = await admin.from('design_cables').select('*').eq('id', itemId).eq('design_id', designId).single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ cable: data })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cableId: string }> }
) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: designId, cableId: itemId } = await params
  const body = await request.json()
  const admin = createAdminClient()

  const allowed: Record<string, unknown> = {}
  for (const f of ['area_id','canvas_id','cable_type','label','waypoints','length_ft','slack_pct','total_length_ft','service_loop_ft','from_device_id','to_device_id','mdf_idf_id','color_hex']) {
    if (body[f] !== undefined) allowed[f] = body[f]
  }
  if (Object.keys(allowed).length === 0) return NextResponse.json({ error: 'No updatable fields' }, { status: 400 })
  allowed.updated_at = new Date().toISOString()

  const { data, error } = await admin.from('design_cables').update(allowed).eq('id', itemId).eq('design_id', designId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ cable: data })
}
