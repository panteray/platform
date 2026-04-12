import { NextRequest, NextResponse } from 'next/server'
import { verifyDesignAccess } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: designId } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('design_walls')
    .select('*')
    .eq('design_id', designId)
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ walls: data ?? [] })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: designId } = await params
  const body = await req.json()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('design_walls')
    .insert({
      design_id: designId,
      org_id: user.org_id,
      area_id: body.area_id || null,
      name: body.name || 'Wall',
      points: body.points || [],
      wall_type: body.wall_type || 'Solid',
      height_ft: body.height_ft ?? 10,
      opacity: body.opacity ?? 1.0,
      color: body.color || '#334155',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ wall: data }, { status: 201 })
}
