import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'

/** GET /api/org/surveys/:id/floor-plans */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('survey_floor_plans')
    .select('*')
    .eq('survey_id', id)
    .eq('org_id', dbUser.org_id)
    .order('display_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/** POST /api/org/surveys/:id/floor-plans — create floor plan */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const admin = createAdminClient()

  // Get max display_order
  const { data: existing } = await admin
    .from('survey_floor_plans')
    .select('display_order')
    .eq('survey_id', id)
    .eq('org_id', dbUser.org_id)
    .order('display_order', { ascending: false })
    .limit(1)

  const nextOrder = existing && existing.length > 0 ? (existing[0].display_order + 1) : 0

  const { data, error } = await admin
    .from('survey_floor_plans')
    .insert({
      survey_id: id,
      org_id: dbUser.org_id,
      name: body.name || 'Floor Plan',
      mode: body.mode || 'floorplan',
      image_url: body.image_url || null,
      image_width: body.image_width || null,
      image_height: body.image_height || null,
      satellite_lat: body.satellite_lat || null,
      satellite_lng: body.satellite_lng || null,
      satellite_zoom: body.satellite_zoom || 18,
      scale_px_per_ft: body.scale_px_per_ft || null,
      display_order: nextOrder,
      notes: body.notes || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

/** DELETE /api/org/surveys/:id/floor-plans?fp_id=... */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await params // validate route
  const fpId = req.nextUrl.searchParams.get('fp_id')
  if (!fpId) return NextResponse.json({ error: 'fp_id required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('survey_floor_plans')
    .delete()
    .eq('id', fpId)
    .eq('org_id', dbUser.org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
