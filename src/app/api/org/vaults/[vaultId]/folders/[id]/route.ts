import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ vaultId: string; id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { count: childCount } = await admin
    .from('vault_folders')
    .select('id', { count: 'exact', head: true })
    .eq('parent_folder_id', id)
  if (childCount && childCount > 0) {
    return NextResponse.json({ error: 'Cannot delete folder that contains subfolders' }, { status: 400 })
  }

  const { count: itemCount } = await admin
    .from('vault_items')
    .select('id', { count: 'exact', head: true })
    .eq('folder_id', id)
  if (itemCount && itemCount > 0) {
    return NextResponse.json({ error: 'Cannot delete folder that contains items' }, { status: 400 })
  }

  const { error } = await admin.from('vault_folders').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
