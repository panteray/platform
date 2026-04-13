import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/org/opportunities/[id]/history
 * Returns status history for an opportunity, newest first.
 * Joins user name for changed_by.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: dbUser } = await admin
    .from('users')
    .select('id, org_id')
    .eq('auth_id', user.id)
    .single()
  if (!dbUser?.org_id) return NextResponse.json({ error: 'No org' }, { status: 403 })

  // Verify opp belongs to org
  const { data: opp } = await admin
    .from('opportunities')
    .select('id')
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .single()
  if (!opp) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: history, error } = await admin
    .from('opp_status_history')
    .select('id, previous_status, new_status, changed_by, on_hold_reason, decline_reason, created_at')
    .eq('opp_id', id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Resolve user names
  const userIds = [...new Set((history ?? []).map((h) => h.changed_by).filter(Boolean))]
  const userMap = new Map<string, string>()
  if (userIds.length > 0) {
    const { data: users } = await admin
      .from('users')
      .select('id, first_name, last_name')
      .in('id', userIds)
    for (const u of users ?? []) {
      userMap.set(u.id, `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || 'Unknown')
    }
  }

  const enriched = (history ?? []).map((h) => ({
    ...h,
    changed_by_name: h.changed_by ? userMap.get(h.changed_by) ?? 'Unknown' : null,
  }))

  return NextResponse.json(enriched)
}
