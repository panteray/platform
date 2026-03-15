import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

async function verifyGlobalAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: dbUser } = await admin.from('users').select('role, is_global_admin').eq('auth_id', user.id).single()
  if (!dbUser || !['GLOBAL_ADMIN', 'GLOBAL_MANAGER'].includes(dbUser.role)) return null
  return user
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyGlobalAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: orgId } = await params
  const body = await request.json()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('custom_roles')
    .insert({ org_id: orgId, name: body.name, base_role: body.base_role, description: body.description })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyGlobalAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('custom_roles')
    .update({ name: body.name, base_role: body.base_role, description: body.description })
    .eq('id', body.role_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(
  request: NextRequest
) {
  const user = await verifyGlobalAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const roleId = searchParams.get('role_id')
  if (!roleId) return NextResponse.json({ error: 'Missing role_id' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('custom_roles').delete().eq('id', roleId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
