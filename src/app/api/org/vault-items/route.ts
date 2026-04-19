import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const vaultId = req.nextUrl.searchParams.get('vault_id')
  if (!vaultId) return NextResponse.json({ error: 'vault_id required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: dbUser } = await admin.from('users').select('org_id').eq('auth_id', user.id).single()
  if (!dbUser?.org_id) return NextResponse.json({ error: 'No org context' }, { status: 403 })

  const { data: vault } = await admin
    .from('document_vaults').select('id')
    .eq('id', vaultId).eq('org_id', dbUser.org_id).single()
  if (!vault) return NextResponse.json({ error: 'Vault not found' }, { status: 404 })

  const { data: items, error } = await admin
    .from('vault_items')
    .select('*')
    .eq('vault_id', vaultId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ items })
}
