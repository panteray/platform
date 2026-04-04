import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgAdmin } from '@/lib/auth'

function generateTempPassword(): string {
  return randomBytes(24).toString('base64url')
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
    password: body.password ?? generateTempPassword(),
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
  if (body.is_active !== undefined) updateData.is_active = body.is_active

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

  // Delete auth first — if this fails, DB record stays intact (recoverable)
  const { error: authError } = await admin.auth.admin.deleteUser(target.auth_id)
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  const { error: dbError } = await admin.from('users').delete().eq('id', id)
  if (dbError) return NextResponse.json({ error: `Auth deleted but DB delete failed: ${dbError.message}` }, { status: 500 })

  return NextResponse.json({ success: true })
}
