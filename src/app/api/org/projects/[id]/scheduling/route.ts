import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'
import { OppStatus } from '@/types/enums'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('scheduling_requests')
    .select('*')
    .eq('project_id', projectId)
    .eq('org_id', caller.org_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    requested_start_date?: string
    requested_end_date?: string | null
    cutoff_date?: string | null
    poc_name?: string | null
    poc_email?: string | null
    poc_phone?: string | null
    notes?: string | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.requested_start_date) {
    return NextResponse.json({ error: 'requested_start_date is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: project, error: pErr } = await admin
    .from('projects')
    .select('id, org_id, opp_id')
    .eq('id', projectId)
    .single()
  if (pErr || !project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  if (project.org_id !== caller.org_id) return NextResponse.json({ error: 'Not in your organization' }, { status: 403 })

  const insert = {
    org_id: caller.org_id,
    project_id: projectId,
    state: 'soft_book',
    requested_start_date: body.requested_start_date,
    requested_end_date: body.requested_end_date || null,
    cutoff_date: body.cutoff_date || null,
    poc_name: body.poc_name?.trim() || null,
    poc_email: body.poc_email?.trim() || null,
    poc_phone: body.poc_phone?.trim() || null,
    notes: body.notes?.trim() || null,
    created_by: caller.id,
  }

  const { data: created, error: insErr } = await admin
    .from('scheduling_requests')
    .insert(insert)
    .select('*')
    .single()
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 })

  if (project.opp_id) {
    const { data: opp } = await admin.from('opportunities').select('status').eq('id', project.opp_id).single()
    if (opp?.status === OppStatus.CKOM) {
      await admin.from('opportunities').update({ status: OppStatus.SCHEDULING }).eq('id', project.opp_id)
      await admin.from('opp_status_history').insert({
        opp_id: project.opp_id, org_id: caller.org_id,
        previous_status: OppStatus.CKOM, new_status: OppStatus.SCHEDULING,
        changed_by: caller.id,
      })
    }
  }

  return NextResponse.json(created)
}
