// ============================================================
// PANTERAY — Database Types (mirrors Phase 1 Supabase schema)
// ============================================================

import type {
  UserRole,
  UserDivision,
  UserType,
  ModuleName,
  CalculatorType,
} from './enums'

// ---- Core Tables ----

export interface Organization {
  id: string
  name: string
  status: 'active' | 'suspended' | 'inactive'
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  phone: string | null
  website: string | null
  logo_url: string | null
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  auth_id: string
  org_id: string
  email: string
  first_name: string
  last_name: string
  phone: string | null
  user_role: UserRole
  division: UserDivision | null
  status: 'active' | 'suspended' | 'inactive'
  custom_role_id: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface UserTypeRecord {
  id: string
  user_id: string
  user_type: UserType
}

export interface UserTypeAssignment {
  id: string
  user_id: string
  user_type: UserType
}

// ---- Roles & Permissions ----

export interface CustomRole {
  id: string
  org_id: string
  name: string
  base_role: UserRole
  description: string | null
  created_at: string
  updated_at: string
}

export type FieldPermissionLevel = 'W' | 'R' | '-'

export interface RoleFieldPermission {
  id: string
  org_id: string
  role_identifier: string // base role name or custom_role_id
  field_key: string
  permission: FieldPermissionLevel
}

export interface UserFieldPermission {
  id: string
  org_id: string
  user_id: string
  field_key: string
  permission: FieldPermissionLevel
}

// ---- Module Config ----

export interface OrgModuleConfig {
  id: string
  org_id: string
  module_name: ModuleName
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface OrgCalculatorConfig {
  id: string
  org_id: string
  calculator_type: CalculatorType
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface OrgPricingConfig {
  id: string
  org_id: string
  key: string
  value: string
}

// ---- System ----

export interface Notification {
  id: string
  org_id: string | null
  user_id: string
  title: string
  message: string
  type: string
  read: boolean
  created_at: string
}

export interface AuditLog {
  id: string
  org_id: string | null
  user_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface EntityLink {
  id: string
  source_type: string
  source_id: string
  target_type: string
  target_id: string
  link_type: string | null
  created_at: string
}

// ---- Global Manager ----

export interface GlobalManagerAssignment {
  id: string
  user_id: string
  org_id: string
  created_at: string
}

// ---- JWT Claims (injected by custom_access_token_hook) ----

export interface JWTClaims {
  org_id: string | null
  user_role: UserRole | null
  is_global_admin: boolean
  user_types: UserType[]
}

// ---- Composite / View types for UI ----

export interface UserWithOrg extends User {
  organization?: Organization
}

export interface OrgWithCounts extends Organization {
  user_count?: number
}
