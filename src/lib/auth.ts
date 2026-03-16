import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const GLOBAL_ROLES = ['GLOBAL_ADMIN', 'GLOBAL_MANAGER']

const ORG_ADMIN_ROLES = ['GLOBAL_ADMIN', 'GLOBAL_MANAGER', 'ORG_ADMIN', 'ORG_MANAGER']

const CRM_ALLOWED_ROLES = [
  'GLOBAL_ADMIN', 'GLOBAL_MANAGER', 'ORG_ADMIN', 'ORG_MANAGER',
  'MANAGER', 'OPERATIONS', 'SALES_ISR', 'SALES_OSR',
  'PRESALES', 'PROJECT_MANAGER', 'TECH_SUP',
]

const DEVICE_LIBRARY_ALLOWED_ROLES = [
  'GLOBAL_ADMIN', 'GLOBAL_MANAGER', 'ORG_ADMIN', 'ORG_MANAGER',
  'PRESALES', 'PROJECT_MANAGER', 'TECH_SUP', 'LEAD',
]

/** Verify caller is GLOBAL_ADMIN or GLOBAL_MANAGER. Returns auth user or null. */
export async function verifyGlobalAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: dbUser } = await admin.from('users').select('role, is_global_admin').eq('auth_id', user.id).single()
  if (!dbUser || !GLOBAL_ROLES.includes(dbUser.role)) return null
  return user
}

/** Verify caller is ORG_ADMIN+ and has an org. Returns dbUser {id, role, org_id, is_global_admin} or null. */
export async function verifyOrgAdmin() {
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
  if (!ORG_ADMIN_ROLES.includes(dbUser.role)) return null
  return dbUser
}

/** Verify caller has CRM access and has an org. Returns dbUser {id, role, org_id, is_global_admin} or null. */
export async function verifyOrgCRM() {
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
  if (!CRM_ALLOWED_ROLES.includes(dbUser.role)) return null
  return dbUser
}

/** Verify caller has Device Library access and has an org. Returns dbUser {id, role, org_id, is_global_admin} or null. */
export async function verifyDeviceLibraryAccess() {
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
  if (!DEVICE_LIBRARY_ALLOWED_ROLES.includes(dbUser.role)) return null
  return dbUser
}
