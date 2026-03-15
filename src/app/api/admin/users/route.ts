import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const admin = createAdminClient()

  // Create auth user
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: body.email,
    password: body.password ?? 'TempPass123!',
    email_confirm: true,
  })

  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  // Create users table row
  const { data: dbUser, error: dbError } = await admin.from('users').insert({
    auth_id: authUser.user.id,
    org_id: body.org_id,
    email: body.email,
    first_name: body.first_name,
    last_name: body.last_name,
    phone: body.phone ?? null,
    user_role: body.user_role,
    division: body.division ?? null,
    status: 'active',
  }).select().single()

  if (dbError) {
    // Rollback auth user on db failure
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
  if (body.user_role !== undefined) updateData.user_role = body.user_role
  if (body.division !== undefined) updateData.division = body.division

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

  // Get auth_id first
  const { data: dbUser } = await admin.from('users').select('auth_id').eq('id', id).single()
  if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Delete from users table first
  const { error: dbError } = await admin.from('users').delete().eq('id', id)
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 })

  // Delete auth user
  await admin.auth.admin.deleteUser(dbUser.auth_id)

  return NextResponse.json({ success: true })
}
