import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/roles'
import { UserRole } from '@/types/enums'

export async function GET() {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccess(dbUser.role, UserRole.MANAGER))
    return NextResponse.json({ error: 'Manager role required' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('psa_org_cost_config')
    .select('*')
    .eq('org_id', dbUser.org_id)
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data ?? { org_id: dbUser.org_id, overhead_burden_pct: 0, default_parts_markup_pct: 0 })
}

export async function PATCH(req: NextRequest) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccess(dbUser.role, UserRole.ORG_ADMIN))
    return NextResponse.json({ error: 'Org Admin role required' }, { status: 403 })

  let body: { overhead_burden_pct?: number; default_parts_markup_pct?: number }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const admin = createAdminClient()
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.overhead_burden_pct !== undefined) update.overhead_burden_pct = body.overhead_burden_pct
  if (body.default_parts_markup_pct !== undefined) update.default_parts_markup_pct = body.default_parts_markup_pct

  // Upsert on org_id
  const { data, error } = await admin
    .from('psa_org_cost_config')
    .upsert({ org_id: dbUser.org_id, ...update }, { onConflict: 'org_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
