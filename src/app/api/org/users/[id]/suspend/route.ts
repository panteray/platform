import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgAdmin } from '@/lib/auth'


export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await verifyOrgAdmin()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const admin = createAdminClient()

  // Verify target is in caller's org
  const { data: target } = await admin.from('users').select('org_id').eq('id', id).single()
  if (!target || target.org_id !== caller.org_id) {
    return NextResponse.json({ error: 'User not in your organization' }, { status: 403 })
  }

  const { data, error } = await admin.from('users')
    .update({ is_active: body.is_active })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
