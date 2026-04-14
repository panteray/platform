import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const vertical = req.nextUrl.searchParams.get('vertical')
  const admin = createAdminClient()
  let query = admin
    .from('psa_job_type_config')
    .select('*')
    .eq('org_id', dbUser.org_id)
    .eq('enabled', true)
    .order('vertical', { ascending: true })
    .order('name', { ascending: true })

  if (vertical) query = query.eq('vertical', vertical)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
