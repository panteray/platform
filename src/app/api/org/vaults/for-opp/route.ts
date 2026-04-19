import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const oppId = req.nextUrl.searchParams.get('opp_id')
  if (!oppId) return NextResponse.json({ error: 'opp_id required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: dbUser } = await admin.from('users').select('org_id').eq('auth_id', user.id).single()
  if (!dbUser?.org_id) return NextResponse.json({ error: 'No org context' }, { status: 403 })

  // Find existing opp vault
  const { data: existing } = await admin
    .from('document_vaults')
    .select('id')
    .eq('opp_id', oppId)
    .eq('vault_type', 'opp')
    .maybeSingle()
  if (existing) return NextResponse.json({ vault: existing })

  // Fallback: create if trigger didn't run (pre-migration opps)
  const { data: opp } = await admin
    .from('opportunities')
    .select('id, org_id')
    .eq('id', oppId)
    .single()
  if (!opp || opp.org_id !== dbUser.org_id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: created, error } = await admin
    .from('document_vaults')
    .insert({ org_id: opp.org_id, opp_id: opp.id, vault_type: 'opp' })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ vault: created }, { status: 201 })
}
