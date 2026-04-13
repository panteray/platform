import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'

/** GET /api/org/surveys/:id — get survey with floor plans, devices, infrastructure */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('surveys')
    .select(`
      *,
      survey_floor_plans(*),
      survey_devices(*),
      survey_infrastructure(*)
    `)
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

/** PATCH /api/org/surveys/:id — update survey fields */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const admin = createAdminClient()

  // Only allow safe fields
  const allowed = [
    'site_name', 'site_address', 'customer_name', 'surveyor_name',
    'survey_date', 'status', 'site_notes', 'infrastructure_notes',
  ]
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  // If moving to in_progress from draft, auto-transition
  if (updates.status === 'in_progress') {
    updates.status = 'in_progress'
  }

  const { data, error } = await admin
    .from('surveys')
    .update(updates)
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/** DELETE /api/org/surveys/:id — delete survey (draft only) */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  // Only allow deleting draft surveys
  const { data: survey } = await admin
    .from('surveys')
    .select('status')
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .single()

  if (!survey) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (survey.status !== 'draft') {
    return NextResponse.json({ error: 'Only draft surveys can be deleted' }, { status: 400 })
  }

  const { error } = await admin
    .from('surveys')
    .delete()
    .eq('id', id)
    .eq('org_id', dbUser.org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
