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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyGlobalAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: orgId } = await params
  const body = await request.json()
  const admin = createAdminClient()

  const { error } = await admin
    .from('role_field_permissions')
    .upsert(
      { org_id: orgId, role_key: body.role_key, field_key: body.field_key, permission: body.permission },
      { onConflict: 'org_id,role_key,field_key' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
