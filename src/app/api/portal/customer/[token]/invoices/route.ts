import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: tokenRow } = await admin
    .from('customer_portal_tokens')
    .select('*')
    .eq('token', token)
    .eq('is_active', true)
    .eq('scope', 'CUSTOMER_ACCOUNT')
    .maybeSingle()
  if (!tokenRow || new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }

  const { data, error } = await admin
    .from('invoices')
    .select('*')
    .eq('customer_id', tokenRow.customer_id)
    .eq('org_id', tokenRow.org_id)
    .neq('status', 'DRAFT')
    .order('issued_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
