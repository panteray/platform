import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'

/**
 * G8: Survey cable polylines.
 *
 * Each row is one cable run drawn on a survey floor plan. Polyline is an
 * array of [x,y] canvas points. Length is computed client-side (sum of
 * segment distances × px/ft × (1 + slack%)).
 */

/** GET /api/org/surveys/:id/cables */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('survey_cables')
    .select('*')
    .eq('survey_id', id)
    .eq('org_id', dbUser.org_id)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/** POST /api/org/surveys/:id/cables */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('survey_cables')
    .insert({
      survey_id: id,
      floor_plan_id: body.floor_plan_id ?? null,
      org_id: dbUser.org_id,
      label: body.label ?? '',
      cable_type: body.cable_type ?? null,
      color_hex: body.color_hex ?? '#2563eb',
      slack_pct: body.slack_pct ?? 10,
      polyline: body.polyline ?? [],
      length_ft: body.length_ft ?? null,
      notes: body.notes ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

/** PATCH /api/org/surveys/:id/cables?cable_id=... */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await params
  const cableId = req.nextUrl.searchParams.get('cable_id')
  if (!cableId) return NextResponse.json({ error: 'cable_id required' }, { status: 400 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const allowed = ['floor_plan_id', 'label', 'cable_type', 'color_hex',
    'slack_pct', 'polyline', 'length_ft', 'notes'] as const
  const update: Record<string, unknown> = {}
  for (const k of allowed) if (body[k] !== undefined) update[k] = body[k]

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('survey_cables')
    .update(update)
    .eq('id', cableId)
    .eq('org_id', dbUser.org_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/** DELETE /api/org/surveys/:id/cables?cable_id=... */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await params
  const cableId = req.nextUrl.searchParams.get('cable_id')
  if (!cableId) return NextResponse.json({ error: 'cable_id required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('survey_cables')
    .delete()
    .eq('id', cableId)
    .eq('org_id', dbUser.org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
