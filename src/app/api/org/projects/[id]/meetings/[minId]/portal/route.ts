import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'

/** GET — list portal tokens for this meeting */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; minId: string }> }
) {
  const { id: projectId, minId } = await params
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('meeting_portal_tokens')
    .select('*')
    .eq('meeting_id', minId)
    .eq('org_id', caller.org_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Only tokens whose meeting belongs to this project
  const { data: meeting } = await admin
    .from('meeting_minutes')
    .select('project_id')
    .eq('id', minId)
    .single()
  if (meeting?.project_id !== projectId) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })

  return NextResponse.json(data ?? [])
}

/** POST — create a new portal token for this meeting */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; minId: string }> }
) {
  const { id: projectId, minId } = await params
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { expires_in_days?: number }
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const admin = createAdminClient()

  const { data: meeting, error: mErr } = await admin
    .from('meeting_minutes')
    .select('id, org_id, project_id')
    .eq('id', minId)
    .eq('project_id', projectId)
    .eq('org_id', caller.org_id)
    .single()
  if (mErr || !meeting) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })

  const expiresInDays = body.expires_in_days ?? 30

  const { data, error } = await admin
    .from('meeting_portal_tokens')
    .insert({
      org_id: caller.org_id,
      meeting_id: minId,
      expires_at: new Date(Date.now() + expiresInDays * 86400000).toISOString(),
      created_by: caller.id,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
