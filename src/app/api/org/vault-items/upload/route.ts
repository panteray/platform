import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { uploadVaultFile } from '@/lib/supabase/vault-storage'
import type { CloudSource } from '@/lib/cloud-sources'

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: dbUser } = await admin.from('users').select('id, org_id').eq('auth_id', user.id).single()
  if (!dbUser?.org_id) return NextResponse.json({ error: 'No org context' }, { status: 403 })

  const form = await req.formData()
  const file = form.get('file')
  const vaultId = ((form.get('vaultId') as string | null) ?? '').trim()
  const folderId = ((form.get('folderId') as string | null) ?? '').trim() || null
  const source = ((form.get('source') as CloudSource | null) ?? 'local_device')

  if (!(file instanceof File)) return NextResponse.json({ error: 'file is required' }, { status: 400 })
  if (!vaultId) return NextResponse.json({ error: 'vaultId is required' }, { status: 400 })
  if (file.size <= 0) return NextResponse.json({ error: 'file is empty' }, { status: 400 })
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'file exceeds 100MB limit' }, { status: 413 })

  const { data: vault } = await admin
    .from('document_vaults')
    .select('id')
    .eq('id', vaultId)
    .eq('org_id', dbUser.org_id)
    .single()
  if (!vault) return NextResponse.json({ error: 'Vault not found' }, { status: 404 })

  const bytes = await file.arrayBuffer()
  const { storagePath } = await uploadVaultFile(
    bytes, dbUser.org_id, vaultId, file.name, file.type || 'application/octet-stream'
  )

  const { data: item, error } = await admin
    .from('vault_items')
    .insert({
      vault_id: vaultId,
      folder_id: folderId,
      item_type: 'uploaded',
      name: file.name,
      file_url: storagePath,
      metadata: { source, content_type: file.type || 'application/octet-stream', size_bytes: file.size },
      created_by: dbUser.id,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item }, { status: 201 })
}
