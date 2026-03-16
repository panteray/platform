// ============================================================
// PANTERAY — Role Hierarchy & Permission Logic
// Phase 5: OPP + CRM + Lead role groups
// ============================================================

import { UserRole, GLOBAL_ROLES } from '@/types/enums'

/** Ordered from highest to lowest privilege */
const ROLE_HIERARCHY: UserRole[] = [
  UserRole.GLOBAL_ADMIN, UserRole.GLOBAL_MANAGER,
  UserRole.ORG_ADMIN, UserRole.ORG_MANAGER,
  UserRole.MANAGER, UserRole.OPERATIONS,
  UserRole.SALES_ISR, UserRole.SALES_OSR,
  UserRole.PRESALES, UserRole.PROJECT_MANAGER,
  UserRole.TECH_SUP, UserRole.LEAD,
  UserRole.FIELD_TECH, UserRole.SUBCONTRACTOR,
  UserRole.CUSTOMER,
]

/** Returns numeric rank (0 = highest privilege) */
export function roleRank(role: UserRole): number {
  const idx = ROLE_HIERARCHY.indexOf(role)
  return idx === -1 ? ROLE_HIERARCHY.length : idx
}

/** True if userRole is at or above requiredRole in hierarchy */
export function canAccess(userRole: UserRole, requiredRole: UserRole): boolean {
  return roleRank(userRole) <= roleRank(requiredRole)
}

/** True if role is GLOBAL_ADMIN or GLOBAL_MANAGER */
export function isGlobalRole(role: UserRole): boolean {
  return (GLOBAL_ROLES as readonly UserRole[]).includes(role)
}

/** True if role is GLOBAL_ADMIN */
export function isGlobalAdmin(role: UserRole): boolean {
  return role === UserRole.GLOBAL_ADMIN
}

/** True if role can manage users in an org (ORG_MANAGER or above) */
export function canManageUsers(role: UserRole): boolean {
  return canAccess(role, UserRole.ORG_MANAGER)
}

/** True if role can manage org settings (ORG_ADMIN or above) */
export function canManageOrg(role: UserRole): boolean {
  return canAccess(role, UserRole.ORG_ADMIN)
}

/** Human-readable role label */
export function roleLabel(role: UserRole): string {
  return ROLE_LABELS[role] ?? role
}

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.GLOBAL_ADMIN]: 'Global Admin',
  [UserRole.GLOBAL_MANAGER]: 'Global Manager',
  [UserRole.ORG_ADMIN]: 'Org Admin',
  [UserRole.ORG_MANAGER]: 'Org Manager',
  [UserRole.MANAGER]: 'Manager',
  [UserRole.OPERATIONS]: 'Operations',
  [UserRole.SALES_ISR]: 'Sales (ISR)',
  [UserRole.SALES_OSR]: 'Sales (OSR)',
  [UserRole.PRESALES]: 'Presales',
  [UserRole.PROJECT_MANAGER]: 'Project Manager',
  [UserRole.TECH_SUP]: 'Tech Support',
  [UserRole.LEAD]: 'Lead',
  [UserRole.FIELD_TECH]: 'Field Tech',
  [UserRole.SUBCONTRACTOR]: 'Subcontractor',
  [UserRole.CUSTOMER]: 'Customer',
}

/** Roles assignable within an org (excludes global roles) */
export const ORG_ASSIGNABLE_ROLES: UserRole[] = ROLE_HIERARCHY.filter(
  (r) => !isGlobalRole(r)
)

/** All base roles */
export const ALL_ROLES = ROLE_HIERARCHY

/** Roles that do NOT require a division assignment */
const NO_DIVISION_ROLES: UserRole[] = [
  UserRole.GLOBAL_ADMIN, UserRole.GLOBAL_MANAGER,
  UserRole.ORG_ADMIN, UserRole.ORG_MANAGER,
]

/** True if role requires a division to be set */
export function requiresDivision(role: UserRole): boolean {
  return !NO_DIVISION_ROLES.includes(role)
}

// ============================================================
// Phase 5 — OPP + CRM + Lead Role Groups
// ============================================================

/** Roles that can create opportunities */
export const OPP_CREATE_ROLES: UserRole[] = [
  UserRole.GLOBAL_ADMIN, UserRole.GLOBAL_MANAGER,
  UserRole.ORG_ADMIN, UserRole.ORG_MANAGER,
  UserRole.MANAGER, UserRole.OPERATIONS,
  UserRole.SALES_ISR, UserRole.SALES_OSR,
  UserRole.PRESALES, UserRole.PROJECT_MANAGER,
]

/** Roles that can view opportunities (broader than create) */
export const OPP_VIEW_ROLES: UserRole[] = [
  ...OPP_CREATE_ROLES,
  UserRole.TECH_SUP, UserRole.LEAD, UserRole.FIELD_TECH,
]

/** Roles that can manage CRM entities (customers/manufacturers/subcontractors) */
export const CRM_MANAGE_ROLES: UserRole[] = [
  UserRole.GLOBAL_ADMIN, UserRole.GLOBAL_MANAGER,
  UserRole.ORG_ADMIN, UserRole.ORG_MANAGER,
  UserRole.MANAGER, UserRole.OPERATIONS,
  UserRole.SALES_ISR, UserRole.SALES_OSR,
  UserRole.PRESALES, UserRole.PROJECT_MANAGER,
  UserRole.TECH_SUP,
]

/** Roles that can view CRM entities (read-only) */
export const CRM_VIEW_ROLES: UserRole[] = [
  ...CRM_MANAGE_ROLES,
  UserRole.LEAD, UserRole.FIELD_TECH,
]

/** Leads: full create, read, update, archive (from Dexter's code — authoritative) */
export const LEAD_CRUD_ROLES: UserRole[] = [
  UserRole.GLOBAL_ADMIN,
  UserRole.GLOBAL_MANAGER,
  UserRole.ORG_ADMIN,
  UserRole.ORG_MANAGER,
  UserRole.MANAGER,
  UserRole.OPERATIONS,
  UserRole.SALES_ISR,
  UserRole.SALES_OSR,
]

/** Leads: read-only (CRUD roles + PRESALES + PROJECT_MANAGER — from Dexter's code) */
export const LEAD_READ_ROLES: UserRole[] = [
  ...LEAD_CRUD_ROLES,
  UserRole.PRESALES,
  UserRole.PROJECT_MANAGER,
]

/** Leads: can reassign lead ownership (from Dexter's code — includes ISR/OSR) */
export const LEAD_REASSIGN_ROLES: UserRole[] = [
  UserRole.GLOBAL_ADMIN,
  UserRole.GLOBAL_MANAGER,
  UserRole.ORG_ADMIN,
  UserRole.ORG_MANAGER,
  UserRole.MANAGER,
  UserRole.OPERATIONS,
  UserRole.SALES_ISR,
  UserRole.SALES_OSR,
]

/** Leads: zero access */
export const LEAD_NO_ACCESS: UserRole[] = [
  UserRole.LEAD,
  UserRole.FIELD_TECH,
  UserRole.SUBCONTRACTOR,
  UserRole.CUSTOMER,
  UserRole.TECH_SUP,
]

/** Check if a role has CRM management access */
export function canManageCRM(role: UserRole): boolean {
  return CRM_MANAGE_ROLES.includes(role)
}

/** Check if a role can create opportunities */
export function canCreateOpp(role: UserRole): boolean {
  return OPP_CREATE_ROLES.includes(role)
}

/** Check if a role can view opportunities */
export function canViewOpp(role: UserRole): boolean {
  return OPP_VIEW_ROLES.includes(role)
}

/** Check if a role has lead CRUD access */
export function canManageLeads(role: UserRole): boolean {
  return LEAD_CRUD_ROLES.includes(role)
}

/** Check if a role can read leads */
export function canReadLeads(role: UserRole): boolean {
  return LEAD_READ_ROLES.includes(role)
}
