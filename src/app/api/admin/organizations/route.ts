import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyGlobalAdmin } from '@/lib/auth'


export async function GET() {
  const user = await verifyGlobalAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('organizations')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const user = await verifyGlobalAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const admin = createAdminClient()

  const { data, error } = await admin.from('organizations').insert({
    name: body.name,
    description: body.description ?? null,
    phone: body.phone ?? null,
    address: body.address ?? null,
    primary_contact_name: body.primary_contact_name ?? null,
    primary_contact_email: body.primary_contact_email ?? null,
    primary_contact_phone: body.primary_contact_phone ?? null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Seed module config rows for new org
  const { ALL_MODULES } = await import('@/types/enums')
  const { CalculatorType } = await import('@/types/enums')

  const moduleRows = ALL_MODULES.map((m) => ({ org_id: data.id, module: m, is_enabled: false }))
  await admin.from('org_module_config').insert(moduleRows)

  const calcRows = Object.values(CalculatorType).map((c) => ({ org_id: data.id, calculator_type: c, is_enabled: false }))
  await admin.from('org_calculator_config').insert(calcRows)

  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest) {
  const user = await verifyGlobalAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const admin = createAdminClient()

  const { data, error } = await admin.from('organizations').update({
    name: body.name,
    description: body.description,
    phone: body.phone,
    address: body.address,
    primary_contact_name: body.primary_contact_name,
    primary_contact_email: body.primary_contact_email,
    primary_contact_phone: body.primary_contact_phone,
  }).eq('id', body.id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const user = await verifyGlobalAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('organizations').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
