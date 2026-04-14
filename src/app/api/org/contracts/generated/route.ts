import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'

function substitute(body: string, vars: Record<string, unknown>): string {
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key) => {
    const v = vars[key]
    return v == null ? '' : String(v)
  })
}

export async function GET(req: NextRequest) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const status = url.searchParams.get('status')
  const customerId = url.searchParams.get('customer_id')

  const admin = createAdminClient()
  let q = admin
    .from('generated_contracts')
    .select('*, customer:customers(id,name), template:contract_templates(id,name,type)')

    .eq('org_id', caller.org_id)
    .order('created_at', { ascending: false })
  if (status) q = q.eq('status', status)
  if (customerId) q = q.eq('customer_id', customerId)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.template_id || !body.customer_id || !body.title) {
    return NextResponse.json({ error: 'template_id, customer_id, title required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Load template + clauses
  const { data: tpl, error: tplErr } = await admin
    .from('contract_templates')
    .select('*')
    .eq('id', body.template_id)
    .eq('org_id', caller.org_id)
    .single()
  if (tplErr || !tpl) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

  const { data: tplClauses } = await admin
    .from('contract_template_clauses')
    .select('*, clause:contract_clauses(*)')
    .eq('template_id', tpl.id)
    .order('display_order', { ascending: true })

  const variables = (body.variables as Record<string, unknown>) ?? {}
  const clauseBodies = (tplClauses ?? [])
    .map((tc: { clause?: { body_md?: string } }) => tc.clause?.body_md ?? '')
    .filter(Boolean)
    .join('\n\n')
  const fullBody = [tpl.body_md ?? '', clauseBodies].filter(Boolean).join('\n\n')
  const content = substitute(fullBody, variables)

  const signToken = randomBytes(32).toString('hex')

  const { data, error } = await admin
    .from('generated_contracts')
    .insert({
      org_id: caller.org_id,
      template_id: tpl.id,
      customer_id: body.customer_id,
      opp_id: body.opp_id ?? null,
      project_id: body.project_id ?? null,
      title: body.title,
      template_type: tpl.type,
      status: 'DRAFT',
      content,
      variables,
      sign_token: signToken,
      expires_at: body.expires_at ?? null,
      created_by: caller.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
