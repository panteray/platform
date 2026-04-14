import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sub_documents')
    .select('*')
    .eq('sub_id', id)
    .eq('org_id', caller.org_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sub_documents')
    .insert({
      org_id: caller.org_id,
      sub_id: id,
      doc_type: body.doc_type ?? 'other',
      doc_name: body.doc_name,
      storage_url: body.storage_url ?? null,
      file_size_bytes: body.file_size_bytes ?? null,
      issued_date: body.issued_date ?? null,
      expires_at: body.expires_at ?? null,
      policy_number: body.policy_number ?? null,
      carrier: body.carrier ?? null,
      coverage_amount: body.coverage_amount ?? null,
      notes: body.notes ?? null,
      uploaded_by: caller.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const url = new URL(req.url)
  const docId = url.searchParams.get('doc_id')
  if (!docId) return NextResponse.json({ error: 'doc_id required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('sub_documents')
    .delete()
    .eq('id', docId)
    .eq('sub_id', id)
    .eq('org_id', caller.org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
