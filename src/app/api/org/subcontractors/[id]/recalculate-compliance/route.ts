import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params

  const admin = createAdminClient()

  // Ownership check
  const { data: target } = await admin
    .from('subcontractors')
    .select('id, org_id')
    .eq('id', id)
    .single()
  if (!target || target.org_id !== caller.org_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { error: rpcErr } = await admin.rpc('recalculate_sub_compliance', { p_sub_id: id })
  if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 400 })

  const { data: updated, error } = await admin
    .from('subcontractors')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json(updated)
}
