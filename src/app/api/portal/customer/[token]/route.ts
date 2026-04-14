import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function loadToken(token: string) {
  const admin = createAdminClient()
  const { data: tokenRow } = await admin
    .from('customer_portal_tokens')
    .select('*')
    .eq('token', token)
    .eq('is_active', true)
    .eq('scope', 'CUSTOMER_ACCOUNT')
    .maybeSingle()
  if (!tokenRow) return { error: 'Invalid or expired token', status: 401 as const }
  if (new Date(tokenRow.expires_at) < new Date()) return { error: 'Token expired', status: 401 as const }
  return { tokenRow, admin }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const r = await loadToken(token)
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status })
  const { tokenRow, admin } = r

  const { data: customer } = await admin
    .from('customers')
    .select('id, name, contact_name, contact_email, contact_phone, address, state')
    .eq('id', tokenRow.customer_id)
    .single()

  return NextResponse.json({
    customer,
    permissions: tokenRow.permissions ?? [],
    expires_at: tokenRow.expires_at,
  })
}
