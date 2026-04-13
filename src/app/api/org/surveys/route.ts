import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'

/** GET /api/org/surveys — list surveys (optionally filtered by opp_id) */
export async function GET(req: NextRequest) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const oppId = req.nextUrl.searchParams.get('opp_id')
  const admin = createAdminClient()

  let q = admin
    .from('surveys')
    .select('*, survey_devices(count), survey_floor_plans(count)')
    .eq('org_id', dbUser.org_id)
    .order('created_at', { ascending: false })

  if (oppId) q = q.eq('opp_id', oppId)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/** POST /api/org/surveys — create survey */
export async function POST(req: NextRequest) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('surveys')
    .insert({
      org_id: dbUser.org_id,
      opp_id: body.opp_id || null,
      site_name: body.site_name || '',
      site_address: body.site_address || null,
      customer_name: body.customer_name || null,
      surveyor_id: dbUser.id,
      surveyor_name: body.surveyor_name || null,
      survey_date: body.survey_date || new Date().toISOString().split('T')[0],
      status: 'draft',
      site_notes: body.site_notes || null,
      infrastructure_notes: body.infrastructure_notes || null,
      created_by: dbUser.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Audit log
  await admin.from('audit_logs').insert({
    org_id: dbUser.org_id,
    user_id: dbUser.id,
    action: 'survey.created',
    entity_type: 'survey',
    entity_id: data.id,
    details: { site_name: data.site_name, opp_id: data.opp_id },
  })

  return NextResponse.json(data, { status: 201 })
}
