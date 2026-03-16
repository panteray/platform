import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgAdmin } from '@/lib/auth'


export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await verifyOrgAdmin()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()

  // Verify target is in caller's org
  const { data: target } = await admin.from('users').select('email, org_id').eq('id', id).single()
  if (!target || target.org_id !== caller.org_id) {
    return NextResponse.json({ error: 'User not in your organization' }, { status: 403 })
  }

  const { error } = await admin.auth.resetPasswordForEmail(target.email)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
