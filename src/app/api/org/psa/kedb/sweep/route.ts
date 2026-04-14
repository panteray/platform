import { NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/roles'
import { UserRole } from '@/types/enums'

/**
 * G7: KEDB auto-archive sweep.
 *
 * Idempotent endpoint — archives any psa_kedb_entries whose 6-month expiry has
 * lapsed. Safe to call from a cron or dashboard refresh. Returns the number of
 * rows archived so callers can show a toast.
 *
 * Scoped to the caller's org only.
 */
export async function POST() {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccess(dbUser.role, UserRole.MANAGER)) {
    return NextResponse.json({ error: 'Manager role required' }, { status: 403 })
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data, error } = await admin
    .from('psa_kedb_entries')
    .update({ archived_at: now })
    .eq('org_id', dbUser.org_id)
    .is('archived_at', null)
    .lt('expires_at', now)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ archived_count: data?.length ?? 0 })
}
