import { NextRequest, NextResponse } from 'next/server'
import { verifyDesignAccess } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

/** GET — list vault documents for an OPP */
export async function GET(req: NextRequest) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const oppId = req.nextUrl.searchParams.get('opp_id')
  if (!oppId) return NextResponse.json({ error: 'opp_id required' }, { status: 400 })
  const admin = createAdminClient()
  const { data } = await admin.from('opp_vault_documents').select('*').eq('opp_id', oppId).eq('org_id', user.org_id).order('created_at', { ascending: false })
  return NextResponse.json({ documents: data ?? [] })
}

/** POST — add a document to the vault */
export async function POST(req: NextRequest) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  if (!body.opp_id || !body.name || !body.document_type) {
    return NextResponse.json({ error: 'opp_id, name, document_type required' }, { status: 400 })
  }
  const admin = createAdminClient()

  // Get next version number for this document type
  const { data: existing } = await admin.from('opp_vault_documents')
    .select('version').eq('opp_id', body.opp_id).eq('document_type', body.document_type)
    .order('version', { ascending: false }).limit(1)
  const nextVersion = (existing?.[0]?.version ?? 0) + 1

  const { data, error } = await admin.from('opp_vault_documents').insert({
    opp_id: body.opp_id,
    org_id: user.org_id,
    name: body.name,
    document_type: body.document_type,
    version: nextVersion,
    status: body.status || 'draft',
    file_url: body.file_url || null,
    file_size_bytes: body.file_size_bytes || null,
    mime_type: body.mime_type || null,
    generated_from: body.generated_from || null,
    metadata: body.metadata || {},
    created_by: user.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ document: data }, { status: 201 })
}
