import { NextRequest, NextResponse } from 'next/server'
import { verifyDesignAccess } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; wallId: string }> }
) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: designId, wallId } = await params
  const body = await req.json()
  const admin = createAdminClient()

  const allowed: Record<string, unknown> = {}
  for (const f of ['name', 'points', 'wall_type', 'height_ft', 'opacity', 'color', 'area_id', 'sort_order']) {
    if (body[f] !== undefined) allowed[f] = body[f]
  }
  if (Object.keys(allowed).length === 0) return NextResponse.json({ error: 'No updatable fields' }, { status: 400 })
  allowed.updated_at = new Date().toISOString()

  const { data, error } = await admin
    .from('design_walls')
    .update(allowed)
    .eq('id', wallId)
    .eq('design_id', designId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ wall: data })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; wallId: string }> }
) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: designId, wallId } = await params
  const admin = createAdminClient()

  const { error } = await admin
    .from('design_walls')
    .delete()
    .eq('id', wallId)
    .eq('design_id', designId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
