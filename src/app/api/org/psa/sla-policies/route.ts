import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('psa_sla_policies')
    .select('*')
    .eq('org_id', dbUser.org_id)
    .order('vertical', { ascending: true })
    .order('ticket_type', { ascending: true })
    .order('priority', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function PATCH(req: NextRequest) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { id?: string; response_min?: number; resolution_min?: number; applies_24x7?: boolean }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const admin = createAdminClient()
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.response_min !== undefined) update.response_min = body.response_min
  if (body.resolution_min !== undefined) update.resolution_min = body.resolution_min
  if (body.applies_24x7 !== undefined) update.applies_24x7 = body.applies_24x7

  const { data, error } = await admin
    .from('psa_sla_policies')
    .update(update)
    .eq('id', body.id)
    .eq('org_id', dbUser.org_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
