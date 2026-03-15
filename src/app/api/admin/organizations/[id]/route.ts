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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyGlobalAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: orgId } = await params
  const admin = createAdminClient()

  const [orgRes, modulesRes, calcsRes, rolesRes, rolePermsRes, userPermsRes] = await Promise.all([
    admin.from('organizations').select('*').eq('id', orgId).single(),
    admin.from('org_module_config').select('*').eq('org_id', orgId),
    admin.from('org_calculator_config').select('*').eq('org_id', orgId),
    admin.from('custom_roles').select('*').eq('org_id', orgId).order('name'),
    admin.from('role_field_permissions').select('*').eq('org_id', orgId),
    admin.from('user_field_permissions').select('*').eq('org_id', orgId),
  ])

  if (orgRes.error) return NextResponse.json({ error: orgRes.error.message }, { status: 404 })

  return NextResponse.json({
    org: orgRes.data,
    modules: modulesRes.data ?? [],
    calculators: calcsRes.data ?? [],
    roles: rolesRes.data ?? [],
    rolePermissions: rolePermsRes.data ?? [],
    userPermissions: userPermsRes.data ?? [],
  })
}
