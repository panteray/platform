import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'

/** POST /api/org/surveys/:id/submit — transition survey to submitted (read-only) */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  // Verify survey exists and belongs to org
  const { data: survey, error: fetchErr } = await admin
    .from('surveys')
    .select('id, status, opp_id, site_name')
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .single()

  if (fetchErr || !survey) return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
  if (survey.status === 'submitted') return NextResponse.json({ error: 'Already submitted' }, { status: 400 })

  // Validate: must have at least one device
  const { count: deviceCount } = await admin
    .from('survey_devices')
    .select('id', { count: 'exact', head: true })
    .eq('survey_id', id)
    .eq('org_id', dbUser.org_id)

  if (!deviceCount || deviceCount === 0) {
    return NextResponse.json({ error: 'Survey must have at least one device before submitting' }, { status: 422 })
  }

  // Update status
  const { data, error } = await admin
    .from('surveys')
    .update({ status: 'submitted' })
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If linked to an OPP, update survey_date_done
  if (survey.opp_id) {
    await admin
      .from('opportunities')
      .update({ survey_date_done: new Date().toISOString().split('T')[0] })
      .eq('id', survey.opp_id)
      .eq('org_id', dbUser.org_id)
  }

  // Audit log
  await admin.from('audit_logs').insert({
    org_id: dbUser.org_id,
    user_id: dbUser.id,
    action: 'survey.submitted',
    entity_type: 'survey',
    entity_id: id,
    details: { site_name: survey.site_name, opp_id: survey.opp_id },
  })

  return NextResponse.json(data)
}
