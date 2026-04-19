import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getSignedDownloadUrl } from '@/lib/supabase/vault-storage'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: dbUser } = await admin.from('users').select('org_id').eq('auth_id', user.id).single()
  if (!dbUser?.org_id) return NextResponse.json({ error: 'No org context' }, { status: 403 })

  const { data: item } = await admin
    .from('vault_items')
    .select('id, file_url, vault_id')
    .eq('id', id)
    .single()
  if (!item?.file_url) return NextResponse.json({ error: 'Vault item not found' }, { status: 404 })

  const { data: vault } = await admin
    .from('document_vaults').select('id')
    .eq('id', item.vault_id).eq('org_id', dbUser.org_id).single()
  if (!vault) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const signedUrl = await getSignedDownloadUrl(item.file_url)
  return NextResponse.json({ signedUrl })
}
