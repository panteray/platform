import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyGlobalAdmin } from '@/lib/auth'


export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyGlobalAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()

  if (!body.password || body.password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Get the auth_id for this user
  const { data: dbUser } = await admin.from('users').select('auth_id').eq('id', id).single()
  if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Set password directly via admin API
  const { error } = await admin.auth.admin.updateUserById(dbUser.auth_id, {
    password: body.password,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
