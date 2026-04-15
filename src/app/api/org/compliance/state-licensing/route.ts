import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/org/compliance/state-licensing
 * Optional filters: ?state=LA, ?status=LICENSE_REQUIRED
 */
export async function GET(req: NextRequest) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const state = req.nextUrl.searchParams.get('state')
  const status = req.nextUrl.searchParams.get('status')

  const admin = createAdminClient()
  let query = admin.from('state_licensing_reference').select('*').order('state', { ascending: true })
  if (state) query = query.eq('state', state.toUpperCase())
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
