import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const admin = createAdminClient()

  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: body.email,
    password: body.password ?? 'TempPass123!',
    email_confirm: true,
  })

  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  const { data: dbUser, error: dbError } = await admin.from('users').insert({
    auth_id: authUser.user.id,
    org_id: body.org_id,
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const admin = createAdminClient()

  const updateData: Record<string, unknown> = {}
  if (body.first_name !== undefined) updateData.first_name = body.first_name
  if (body.last_name !== undefined) updateData.last_name = body.last_name
  if (body.phone !== undefined) updateData.phone = body.phone
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const admin = createAdminClient()

  const { data: dbUser } = await admin.from('users').select('auth_id').eq('id', id).single()
  if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { error: dbError } = await admin.from('users').delete().eq('id', id)
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 })

  await admin.auth.admin.deleteUser(dbUser.auth_id)
  return NextResponse.json({ success: true })
}
