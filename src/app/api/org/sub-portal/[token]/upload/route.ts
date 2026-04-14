import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Sub-side: upload daily report or doc via token
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const admin = createAdminClient()

  // Validate token
  const { data: tokenRow } = await admin
    .from('sub_portal_tokens')
    .select('*')
    .eq('token', token)
    .eq('is_active', true)
    .maybeSingle()

  if (!tokenRow || new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }

  if (!tokenRow.permissions?.includes('upload')) {
    return NextResponse.json({ error: 'Upload not permitted' }, { status: 403 })
  }

  const uploadType = body.upload_type as string

  if (uploadType === 'daily_report') {
    // Insert into daily_reports
    const { data, error } = await admin
      .from('daily_reports')
      .insert({
        org_id: tokenRow.org_id,
        project_id: tokenRow.project_id,
        report_date: body.report_date ?? new Date().toISOString().split('T')[0],
        author_id: null, // sub doesn't have user account
        summary: body.summary ?? null,
        weather: body.weather ?? null,
        crew_count: body.crew_count ?? 0,
        hours_worked: body.hours_worked ?? 0,
        safety_notes: body.safety_notes ?? null,
        photos: body.photos ?? [],
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  }

  if (uploadType === 'document') {
    const { data, error } = await admin
      .from('sub_documents')
      .insert({
        org_id: tokenRow.org_id,
        sub_id: tokenRow.sub_id,
        doc_type: body.doc_type ?? 'other',
        doc_name: body.doc_name,
        storage_url: body.storage_url ?? null,
        file_size_bytes: body.file_size_bytes ?? null,
        issued_date: body.issued_date ?? null,
        expires_at: body.expires_at ?? null,
        notes: body.notes ?? null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  }

  return NextResponse.json({ error: 'Unknown upload_type' }, { status: 400 })
}
