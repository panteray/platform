import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { signProjectDocumentUrl } from '@/lib/documents/storage'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: projectId, docId } = await params
  const admin = createAdminClient()

  const { data: doc, error } = await admin
    .from('project_documents')
    .select('storage_path, filename, mime_type')
    .eq('id', docId)
    .eq('project_id', projectId)
    .eq('org_id', caller.org_id)
    .single<{ storage_path: string; filename: string; mime_type: string }>()

  if (error || !doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  try {
    const url = await signProjectDocumentUrl(doc.storage_path)
    return NextResponse.json({ url, filename: doc.filename, mime_type: doc.mime_type })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to sign URL'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
