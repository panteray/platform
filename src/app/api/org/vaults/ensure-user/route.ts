import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: dbUser } = await admin
    .from('users')
    .select('id, org_id')
    .eq('auth_id', user.id)
    .single()

  if (!dbUser?.org_id) return NextResponse.json({ error: 'No org context' }, { status: 403 })

  const { data: existing } = await admin
    .from('document_vaults')
    .select('id')
    .eq('vault_type', 'user')
    .eq('user_id', dbUser.id)
    .eq('org_id', dbUser.org_id)
    .maybeSingle()

  if (existing) return NextResponse.json({ vault: existing })

  const { data: created, error } = await admin
    .from('document_vaults')
    .insert({ org_id: dbUser.org_id, user_id: dbUser.id, vault_type: 'user' })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ vault: created }, { status: 201 })
}
