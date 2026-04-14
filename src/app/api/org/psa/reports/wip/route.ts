import { NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/roles'
import { UserRole } from '@/types/enums'

const OPEN_STATUSES = [
  'NEW', 'OPEN', 'SCHEDULED', 'EN_ROUTE', 'ON_SITE',
  'WORK_IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'WAITING_ON_PARTS',
  'WAITING_ON_VENDOR', 'WAITING_ON_SITE_ACCESS', 'NEEDS_RMA',
]

export async function GET() {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccess(dbUser.role, UserRole.MANAGER))
    return NextResponse.json({ error: 'Manager role required' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('psa_ticket_costing_v')
    .select('*')
    .eq('org_id', dbUser.org_id)
    .eq('costing_enabled', true)
    .in('status', OPEN_STATUSES)
    .order('budget_burn_pct', { ascending: false, nullsFirst: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
