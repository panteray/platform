import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

async function getCaller() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: dbUser } = await admin
    .from('users')
    .select('id, org_id')
    .eq('auth_id', user.id)
    .single()
  if (!dbUser?.org_id) return null
  return { id: dbUser.id, orgId: dbUser.org_id, admin }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ vaultId: string }> }) {
  const { vaultId } = await params
  const caller = await getCaller()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: folders, error } = await caller.admin
    .from('vault_folders')
    .select('*')
    .eq('vault_id', vaultId)
    .order('sort_order')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ folders })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ vaultId: string }> }) {
  const { vaultId } = await params
  const caller = await getCaller()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const name = (body.name as string | undefined)?.trim()
  if (!name) return NextResponse.json({ error: 'Folder name is required' }, { status: 400 })

  const { data: vault } = await caller.admin
    .from('document_vaults')
    .select('id')
    .eq('id', vaultId)
    .eq('org_id', caller.orgId)
    .single()
  if (!vault) return NextResponse.json({ error: 'Vault not found' }, { status: 404 })

  const { data: folder, error } = await caller.admin
    .from('vault_folders')
    .insert({
      org_id: caller.orgId,
      vault_id: vaultId,
      parent_folder_id: (body.parent_id as string) || null,
      name,
      sort_order: typeof body.sort_order === 'number' ? body.sort_order : 0,
      created_by: caller.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ folder }, { status: 201 })
}
