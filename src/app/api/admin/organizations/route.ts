import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify global admin via JWT
  const { data: dbUser } = await supabase.from('users').select('user_role').eq('auth_id', user.id).single()
  if (!dbUser || !['GLOBAL_ADMIN', 'GLOBAL_MANAGER'].includes(dbUser.user_role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const admin = createAdminClient()

  const { data, error } = await admin.from('organizations').insert({
    name: body.name,
    address: body.address ?? null,
    city: body.city ?? null,
    state: body.state ?? null,
    zip: body.zip ?? null,
    phone: body.phone ?? null,
    website: body.website ?? null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Seed module config rows for new org
  const { ALL_MODULES } = await import('@/types/enums')
  const { CalculatorType } = await import('@/types/enums')

  const moduleRows = ALL_MODULES.map((m) => ({ org_id: data.id, module_name: m, enabled: false }))
  await admin.from('org_module_config').insert(moduleRows)

  const calcRows = Object.values(CalculatorType).map((c) => ({ org_id: data.id, calculator_type: c, enabled: false }))
  await admin.from('org_calculator_config').insert(calcRows)

  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const admin = createAdminClient()

  const { data, error } = await admin.from('organizations').update({
    name: body.name,
    address: body.address,
    city: body.city,
    state: body.state,
    zip: body.zip,
    phone: body.phone,
    website: body.website,
  }).eq('id', body.id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('organizations').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
