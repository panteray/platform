import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'

/** POST — stamp start_reminder_sent_at (manual path; the client generates the
 *  install_reminder doc via the existing documents API first, mirroring the
 *  CustomerIntroAction pattern). */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: project, error: pErr } = await admin
    .from('projects')
    .select('id, org_id')
    .eq('id', projectId)
    .single()
  if (pErr || !project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  if (project.org_id !== caller.org_id) return NextResponse.json({ error: 'Not in your organization' }, { status: 403 })

  const now = new Date().toISOString()
  const { error: uErr } = await admin
    .from('projects')
    .update({ start_reminder_sent_at: now })
    .eq('id', projectId)
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 400 })

  return NextResponse.json({ start_reminder_sent_at: now })
}
