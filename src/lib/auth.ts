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
  'MANAGER', 'PRESALES', 'PROJECT_MANAGER', 'TECH_SUP', 'LEAD',
]

const DEVICE_LIBRARY_WRITE_ROLES = DEVICE_LIBRARY_ALLOWED_ROLES

/** Returns true if the given role can add/edit/delete device library items. */
export function canWriteDeviceLibrary(role: string | null | undefined): boolean {
  return !!role && DEVICE_LIBRARY_WRITE_ROLES.includes(role)
}

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

const LEAD_CRUD_ALLOWED_ROLES = [
  'GLOBAL_ADMIN', 'GLOBAL_MANAGER', 'ORG_ADMIN', 'ORG_MANAGER',
  'MANAGER', 'OPERATIONS', 'SALES_ISR', 'SALES_OSR',
]

const LEAD_READ_ALLOWED_ROLES = [
  ...LEAD_CRUD_ALLOWED_ROLES,
  'PRESALES', 'PROJECT_MANAGER',
]

/** Verify caller has lead CRUD access and has an org. Returns dbUser or null. */
export async function verifyLeadCrud() {
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
  if (!LEAD_CRUD_ALLOWED_ROLES.includes(dbUser.role)) return null
  return dbUser
}

/** Verify caller has lead read access and has an org. Returns dbUser or null. */
export async function verifyLeadRead() {
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
  if (!LEAD_READ_ALLOWED_ROLES.includes(dbUser.role)) return null
  return dbUser
}

const DESIGN_ALLOWED_ROLES = [
  'GLOBAL_ADMIN', 'GLOBAL_MANAGER', 'ORG_ADMIN', 'ORG_MANAGER',
  'PRESALES', 'PROJECT_MANAGER', 'TECH_SUP', 'LEAD', 'MANAGER', 'OPERATIONS',
]

/** Verify caller has Design Canvas access and has an org. Returns dbUser {id, role, org_id, is_global_admin} or null. */
export async function verifyDesignAccess() {
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
  if (!DESIGN_ALLOWED_ROLES.includes(dbUser.role)) return null
  return dbUser
}
