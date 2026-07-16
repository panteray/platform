import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: project, error: pErr } = await admin
    .from('projects')
    .select('id, org_id, opp_id')
    .eq('id', projectId)
    .single()
  if (pErr || !project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  if (project.org_id !== caller.org_id) return NextResponse.json({ error: 'Not in your organization' }, { status: 403 })

  const now = new Date().toISOString()

  if (project.opp_id) {
    const { error: oErr } = await admin
      .from('opportunities')
      .update({ customer_intro_sent_at: now })
      .eq('id', project.opp_id)
      .eq('org_id', caller.org_id)
    if (oErr) return NextResponse.json({ error: oErr.message }, { status: 400 })
  }

  return NextResponse.json({ customer_intro_sent_at: now, opp_id: project.opp_id })
}
