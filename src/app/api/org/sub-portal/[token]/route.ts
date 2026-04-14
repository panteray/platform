import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Public token-gated read
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: tokenRow, error: tokenErr } = await admin
    .from('sub_portal_tokens')
    .select('*')
    .eq('token', token)
    .eq('is_active', true)
    .maybeSingle()

  if (tokenErr || !tokenRow) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }

  if (new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Token expired' }, { status: 401 })
  }

  // Bump access counter
  await admin
    .from('sub_portal_tokens')
    .update({
      accessed_at: new Date().toISOString(),
      access_count: (tokenRow.access_count ?? 0) + 1,
    })
    .eq('id', tokenRow.id)

  // Fetch sub assignment + project + sub info
  const [assignmentRes, projectRes, subRes] = await Promise.all([
    admin
      .from('sub_assignments')
      .select('*')
      .eq('project_id', tokenRow.project_id)
      .eq('sub_id', tokenRow.sub_id)
      .eq('org_id', tokenRow.org_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('projects')
      .select('id, pn, name, status, site_address, site_city, site_state, start_date, target_end_date')
      .eq('id', tokenRow.project_id)
      .eq('org_id', tokenRow.org_id)
      .single(),
    admin
      .from('subcontractors')
      .select('id, name, primary_contact_name, primary_contact_email, primary_contact_phone')
      .eq('id', tokenRow.sub_id)
      .eq('org_id', tokenRow.org_id)
      .single(),
  ])

  return NextResponse.json({
    project: projectRes.data,
    sub: subRes.data,
    assignment: assignmentRes.data,
    permissions: tokenRow.permissions ?? [],
  })
}
