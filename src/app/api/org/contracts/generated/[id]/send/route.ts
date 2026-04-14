import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('generated_contracts')
    .select('*')
    .eq('id', id)
    .eq('org_id', caller.org_id)
    .single()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.status !== 'DRAFT' && existing.status !== 'PENDING_REVIEW') {
    return NextResponse.json({ error: `Cannot send from status ${existing.status}` }, { status: 400 })
  }

  const update: Record<string, unknown> = {
    status: 'SENT',
    sent_at: new Date().toISOString(),
  }
  if (!existing.sign_token) {
    update.sign_token = randomBytes(32).toString('hex')
  }

  const { data, error } = await admin
    .from('generated_contracts')
    .update(update)
    .eq('id', id)
    .eq('org_id', caller.org_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
