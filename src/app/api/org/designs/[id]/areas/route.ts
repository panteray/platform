import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyDesignAccess } from '@/lib/auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyDesignAccess()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: designId } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('design_areas')
    .select('*')
    .eq('design_id', designId)
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ areas: data ?? [] })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyDesignAccess()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: designId } = await params
  const admin = createAdminClient()

  // Verify design belongs to org
  const { data: design } = await admin
    .from('designs')
    .select('id, org_id')
    .eq('id', designId)
    .single()
  if (!design || design.org_id !== dbUser.org_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const name = (body.name as string)?.trim() || 'New Area'
  const canvasType = (body.canvas_type as string) || 'FLOOR_PLAN'

  // Get next sort_order
  const { data: existing } = await admin
    .from('design_areas')
    .select('sort_order')
    .eq('design_id', designId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextSort = (existing?.[0]?.sort_order ?? -1) + 1

  const { data: area, error } = await admin
    .from('design_areas')
    .insert({
      design_id: designId,
      org_id: dbUser.org_id,
      name,
      canvas_type: canvasType,
      sort_order: nextSort,
      satellite_zoom: 16,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ area }, { status: 201 })
}
