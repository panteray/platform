import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET — current user profile
export async function GET() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: profile, error } = await admin
    .from('users')
    .select('id, org_id, first_name, last_name, email, phone, title, role, divisions, region, region_state, avatar_url, is_active, created_at')
    .eq('auth_id', authUser.id)
    .single()

  if (error || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // Get org name if user has an org
  let orgName: string | null = null
  if (profile.org_id) {
    const { data: org } = await admin
      .from('organizations')
      .select('name, brand_color, logo_url')
      .eq('id', profile.org_id)
      .single()
    orgName = org?.name ?? null
  }

  return NextResponse.json({ ...profile, org_name: orgName })
}

// PATCH — update own profile (limited fields) + optional password change
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { first_name, last_name, phone, title, avatar_url, new_password } = body

  const admin = createAdminClient()

  // Get current user record
  const { data: dbUser } = await admin
    .from('users')
    .select('id')
    .eq('auth_id', authUser.id)
    .single()

  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Update profile fields
  const updates: Record<string, unknown> = {}
  if (first_name !== undefined) updates.first_name = first_name?.trim() || null
  if (last_name !== undefined) updates.last_name = last_name?.trim() || null
  if (phone !== undefined) updates.phone = phone?.trim() || null
  if (title !== undefined) updates.title = title?.trim() || null
  if (avatar_url !== undefined) updates.avatar_url = avatar_url?.trim() || null

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await admin
      .from('users')
      .update(updates)
      .eq('id', dbUser.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }
  }

  // Password change (self-service via Supabase Auth)
  if (new_password && typeof new_password === 'string' && new_password.length >= 8) {
    const { error: pwError } = await admin.auth.admin.updateUserById(
      authUser.id,
      { password: new_password }
    )
    if (pwError) {
      return NextResponse.json({ error: pwError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
