import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const kind = req.nextUrl.searchParams.get('kind')

  let query = admin
    .from('qc_templates')
    .select('id, key, name, kind, items, item_count')
    .eq('is_active', true)
    .or(`org_id.is.null,org_id.eq.${dbUser.org_id}`)
    .order('kind', { ascending: true })
    .order('name', { ascending: true })

  if (kind) query = query.eq('kind', kind)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
