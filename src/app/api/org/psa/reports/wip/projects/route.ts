import { NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/roles'
import { UserRole } from '@/types/enums'

/**
 * G6: Project-level WIP rollup. Reads psa_project_costing_v, filters to the
 * caller's org, returns projects with at least one open (costing-enabled)
 * ticket sorted by budget burn desc.
 */
export async function GET() {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccess(dbUser.role, UserRole.MANAGER)) {
    return NextResponse.json({ error: 'Manager role required' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('psa_project_costing_v')
    .select('*')
    .eq('org_id', dbUser.org_id)
    .gt('ticket_count', 0)
    .order('budget_burn_pct', { ascending: false, nullsFirst: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
