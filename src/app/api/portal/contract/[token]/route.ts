import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: contract, error } = await admin
    .from('generated_contracts')
    .select('*, customer:customers(id,name,contact_name,contact_email)')
    .eq('sign_token', token)
    .maybeSingle()

  if (error || !contract) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  if (contract.status === 'CANCELLED' || contract.status === 'EXPIRED') {
    return NextResponse.json({ error: `Contract ${contract.status.toLowerCase()}` }, { status: 410 })
  }
  if (contract.expires_at && new Date(contract.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Contract expired' }, { status: 410 })
  }

  return NextResponse.json({
    id: contract.id,
    contract_number: contract.contract_number,
    title: contract.title,
    template_type: contract.template_type,
    status: contract.status,
    content: contract.content,
    customer: contract.customer,
    sent_at: contract.sent_at,
    signed_at: contract.signed_at,
    signature_url: contract.signature_url,
    expires_at: contract.expires_at,
  })
}
