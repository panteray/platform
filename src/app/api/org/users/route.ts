import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

async function verifyOrgAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: dbUser } = await admin
    .from('users')
    .select('id, role, org_id, is_global_admin')
    .eq('auth_id', user.id)
    .single()
  if (!dbUser || !dbUser.org_id) return null
  // ORG_ADMIN, ORG_MANAGER, or global roles can manage org users
  const allowed = ['GLOBAL_ADMIN', 'GLOBAL_MANAGER', 'ORG_ADMIN', 'ORG_MANAGER']
  if (!allowed.includes(dbUser.role)) return null
  return dbUser
}

export async function GET() {
  const caller = await verifyOrgAdmin()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('users')
    .select('*')
    .eq('org_id', caller.org_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const caller = await verifyOrgAdmin()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const admin = createAdminClient()

  // Create auth user
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: body.email,
    password: body.password ?? 'TempPass123!',
    email_confirm: true,
  })

  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  // Create DB user — always scoped to caller's org
  const { data: dbUser, error: dbError } = await admin.from('users').insert({
    auth_id: authUser.user.id,
    org_id: caller.org_id,
    email: body.email,
    first_name: body.first_name,
    last_name: body.last_name,
    phone: body.phone ?? null,
    role: body.role,
    divisions: body.divisions ?? [],
    is_active: true,
  }).select().single()

  if (dbError) {
    await admin.auth.admin.deleteUser(authUser.user.id)
    return NextResponse.json({ error: dbError.message }, { status: 400 })
  }

  return NextResponse.json(dbUser)
}

export async function PATCH(request: NextRequest) {
  const caller = await verifyOrgAdmin()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const admin = createAdminClient()

  // Verify target user is in caller's org
  const { data: target } = await admin.from('users').select('org_id').eq('id', body.id).single()
  if (!target || target.org_id !== caller.org_id) {
    return NextResponse.json({ error: 'User not in your organization' }, { status: 403 })
  }

  const updateData: Record<string, unknown> = {}
  if (body.first_name !== undefined) updateData.first_name = body.first_name
  if (body.last_name !== undefined) updateData.last_name = body.last_name
  if (body.phone !== undefined) updateData.phone = body.phone
  if (body.title !== undefined) updateData.title = body.title
  if (body.role !== undefined) updateData.role = body.role
  if (body.divisions !== undefined) updateData.divisions = body.divisions

  const { data, error } = await admin.from('users')
    .update(updateData)
    .eq('id', body.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const caller = await verifyOrgAdmin()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const admin = createAdminClient()

  // Verify target user is in caller's org
  const { data: target } = await admin.from('users').select('auth_id, org_id').eq('id', id).single()
  if (!target || target.org_id !== caller.org_id) {
    return NextResponse.json({ error: 'User not in your organization' }, { status: 403 })
  }

  const { error: dbError } = await admin.from('users').delete().eq('id', id)
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 })

  await admin.auth.admin.deleteUser(target.auth_id)
  return NextResponse.json({ success: true })
}
