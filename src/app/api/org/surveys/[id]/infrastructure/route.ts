import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'

/** GET /api/org/surveys/:id/infrastructure */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('survey_infrastructure')
    .select('*')
    .eq('survey_id', id)
    .eq('org_id', dbUser.org_id)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/** POST /api/org/surveys/:id/infrastructure */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('survey_infrastructure')
    .insert({
      survey_id: id,
      floor_plan_id: body.floor_plan_id || null,
      org_id: dbUser.org_id,
      type: body.type || 'mdf',
      name: body.name || '',
      mdf_idf_locations: body.mdf_idf_locations || null,
      conduit_pathway: body.conduit_pathway || null,
      power_availability: body.power_availability || null,
      network_infrastructure: body.network_infrastructure || null,
      location: body.location || null,
      notes: body.notes || null,
      photos: body.photos || [],
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

/** PATCH /api/org/surveys/:id/infrastructure?infra_id=... */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await params
  const infraId = req.nextUrl.searchParams.get('infra_id')
  if (!infraId) return NextResponse.json({ error: 'infra_id required' }, { status: 400 })

  const body = await req.json()
  const admin = createAdminClient()

  const allowed = [
    'floor_plan_id', 'type', 'name', 'mdf_idf_locations', 'conduit_pathway',
    'power_availability', 'network_infrastructure', 'location', 'notes', 'photos',
  ]
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  const { data, error } = await admin
    .from('survey_infrastructure')
    .update(updates)
    .eq('id', infraId)
    .eq('org_id', dbUser.org_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/** DELETE /api/org/surveys/:id/infrastructure?infra_id=... */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await params
  const infraId = req.nextUrl.searchParams.get('infra_id')
  if (!infraId) return NextResponse.json({ error: 'infra_id required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('survey_infrastructure')
    .delete()
    .eq('id', infraId)
    .eq('org_id', dbUser.org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
