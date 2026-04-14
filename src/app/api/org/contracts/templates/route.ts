import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const type = url.searchParams.get('type')
  const status = url.searchParams.get('status')

  const admin = createAdminClient()
  let q = admin
    .from('contract_templates')
    .select('*')
    .eq('org_id', caller.org_id)
    .order('updated_at', { ascending: false })
  if (type) q = q.eq('type', type)
  if (status) q = q.eq('status', status)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.type || !body.name) return NextResponse.json({ error: 'type and name required' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('contract_templates')
    .insert({
      org_id: caller.org_id,
      type: body.type,
      name: body.name,
      version: 1,
      status: 'DRAFT',
      body_md: body.body_md ?? '',
      variables: body.variables ?? [],
      created_by: caller.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
