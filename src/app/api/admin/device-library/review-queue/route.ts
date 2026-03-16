import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyGlobalAdmin } from '@/lib/auth'

export async function GET() {
  const user = await verifyGlobalAdmin()
  if (!user) {
    return NextResponse.json({ error: 'Global admin only' }, { status: 403 })
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('device_library_contributions')
    .select(`
      *,
      device_library_items (
        id, vendor, model, partnumber, category, subcategory, ndaa_compliant, org_id
      ),
      organizations:org_id ( name )
    `)
    .eq('status', 'pending_review')
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Fetch submitter names separately (avoid FK ambiguity)
  const submitterIds = (data ?? [])
    .map((c) => c.submitted_by)
    .filter((id): id is string => !!id)

  let submitterMap: Record<string, { first_name: string; last_name: string }> = {}
  if (submitterIds.length > 0) {
    const { data: users } = await admin
      .from('users')
      .select('id, first_name, last_name')
      .in('id', submitterIds)

    if (users) {
      submitterMap = Object.fromEntries(
        users.map((u) => [u.id, { first_name: u.first_name, last_name: u.last_name }])
      )
    }
  }

  const contributions = (data ?? []).map((c) => ({
    ...c,
    submitted_user: c.submitted_by ? submitterMap[c.submitted_by] ?? null : null,
  }))

  return NextResponse.json({ contributions })
}
