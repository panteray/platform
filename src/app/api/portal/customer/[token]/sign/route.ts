import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: tokenRow } = await admin
    .from('customer_portal_tokens')
    .select('*')
    .eq('token', token)
    .eq('is_active', true)
    .maybeSingle()
  if (!tokenRow || new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.entity_type || !body.entity_id || !body.signature_data_url || !body.signed_by_name) {
    return NextResponse.json({ error: 'entity_type, entity_id, signature_data_url, signed_by_name required' }, { status: 400 })
  }

  // Decode data URL → upload to storage
  const dataUrl = body.signature_data_url as string
  const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/)
  if (!match) return NextResponse.json({ error: 'Invalid signature_data_url' }, { status: 400 })
  const ext = match[1]
  const buffer = Buffer.from(match[2], 'base64')
  const filename = `${tokenRow.org_id}/${body.entity_type}/${body.entity_id}-${Date.now()}.${ext}`

  const { error: uploadErr } = await admin.storage
    .from('customer-signatures')
    .upload(filename, buffer, { contentType: `image/${ext}`, upsert: true })
  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  const { data: pub } = admin.storage.from('customer-signatures').getPublicUrl(filename)
  const signatureUrl = pub.publicUrl

  const ipAddress = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip')
  const userAgent = req.headers.get('user-agent')

  const { data, error } = await admin
    .from('customer_signatures')
    .insert({
      org_id: tokenRow.org_id,
      customer_id: tokenRow.customer_id,
      entity_type: body.entity_type,
      entity_id: body.entity_id,
      signature_url: signatureUrl,
      signed_by_name: body.signed_by_name,
      signed_by_email: body.signed_by_email ?? null,
      ip_address: ipAddress,
      user_agent: userAgent,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
