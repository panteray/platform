import { NextRequest, NextResponse } from 'next/server'
import { verifyDesignAccess } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = createAdminClient()
  const { data } = await admin.from('user_vault_documents').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
  return NextResponse.json({ documents: data ?? [] })
}

export async function POST(req: NextRequest) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const admin = createAdminClient()
  const { data, error } = await admin.from('user_vault_documents').insert({
    user_id: user.id, org_id: user.org_id,
    name: body.name || 'Untitled', document_type: body.document_type || null,
    file_url: body.file_url || null, file_size_bytes: body.file_size_bytes || null,
    mime_type: body.mime_type || null, metadata: body.metadata || {},
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ document: data }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const docId = req.nextUrl.searchParams.get('id')
  if (!docId) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const admin = createAdminClient()
  await admin.from('user_vault_documents').delete().eq('id', docId).eq('user_id', user.id)
  return NextResponse.json({ deleted: true })
}
