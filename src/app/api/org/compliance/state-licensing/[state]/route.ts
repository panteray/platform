import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/org/compliance/state-licensing/[state]
 * Get the org's licensing record for a specific state (2-char code).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ state: string }> }) {
  const { state } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('org_state_licensing')
    .select('*')
    .eq('org_id', dbUser.org_id)
    .eq('state', state.toUpperCase())
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'State not found' }, { status: 404 })
  return NextResponse.json(data)
}
