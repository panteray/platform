import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: contract } = await admin
    .from('generated_contracts')
    .select('*')
    .eq('sign_token', token)
    .maybeSingle()

  if (!contract) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  if (contract.status === 'ACTIVE' || contract.signed_at) {
    return NextResponse.json({ error: 'Already signed' }, { status: 409 })
  }
  if (contract.status === 'CANCELLED' || contract.status === 'EXPIRED') {
    return NextResponse.json({ error: `Contract ${contract.status.toLowerCase()}` }, { status: 410 })
  }
  if (contract.expires_at && new Date(contract.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Contract expired' }, { status: 410 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.signature_data_url || !body.signed_by_name) {
    return NextResponse.json({ error: 'signature_data_url, signed_by_name required' }, { status: 400 })
  }

  const dataUrl = body.signature_data_url as string
  const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/)
  if (!match) return NextResponse.json({ error: 'Invalid signature_data_url' }, { status: 400 })
  const ext = match[1]
  const buffer = Buffer.from(match[2], 'base64')
  const filename = `${contract.org_id}/contracts/${contract.id}-${Date.now()}.${ext}`

  const { error: uploadErr } = await admin.storage
    .from('contract-pdfs')
    .upload(filename, buffer, { contentType: `image/${ext}`, upsert: true })
  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  const { data: pub } = admin.storage.from('contract-pdfs').getPublicUrl(filename)
  const signatureUrl = pub.publicUrl

  const ipAddress = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip')
  const userAgent = req.headers.get('user-agent')

  const { data, error } = await admin
    .from('generated_contracts')
    .update({
      status: 'ACTIVE',
      signed_at: new Date().toISOString(),
      signed_by_name: body.signed_by_name,
      signed_by_email: body.signed_by_email ?? null,
      signature_url: signatureUrl,
    })
    .eq('id', contract.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Also record in customer_signatures for audit
  await admin.from('customer_signatures').insert({
    org_id: contract.org_id,
    customer_id: contract.customer_id,
    entity_type: 'contract',
    entity_id: contract.id,
    signature_url: signatureUrl,
    signed_by_name: body.signed_by_name,
    signed_by_email: body.signed_by_email ?? null,
    ip_address: ipAddress,
    user_agent: userAgent,
  })

  return NextResponse.json(data)
}
