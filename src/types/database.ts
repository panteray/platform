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
  description: string | null
  phone: string | null
  address: string | null
  primary_contact_name: string | null
  primary_contact_email: string | null
  primary_contact_phone: string | null
  is_active: boolean
  logo_url: string | null
  brand_color: string | null
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  auth_id: string
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  title: string | null
  avatar_url: string | null
  role: UserRole
  is_global_admin: boolean
  org_id: string | null
  is_active: boolean
  subcontractor_id: string | null
  custom_role_id: string | null
  divisions: UserDivision[]
  region: string | null
  region_state: string | null
  ticket_email_notifications: boolean
  preferences: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface UserTypeRecord {
  id: string
  user_id: string
  type: UserType
  created_at: string
}

export interface UserTypeAssignment {
  user_id: string
  opp_type: string
}

// ---- Roles & Permissions ----

export interface CustomRole {
  id: string
  org_id: string
  name: string
  base_role: UserRole | null
  description: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type FieldPermissionLevel = 'W' | 'R' | '-'

export interface RoleFieldPermission {
  id: string
  org_id: string
  role_key: string
  custom_role_id: string | null
  field_key: string
  permission: FieldPermissionLevel
  created_by: string | null
  updated_at: string
}

export interface UserFieldPermission {
  id: string
  org_id: string
  user_id: string
  field_key: string
  permission: FieldPermissionLevel
  overridden_by: string | null
  updated_at: string
}

// ---- Module Config ----

export interface OrgModuleConfig {
  id: string
  org_id: string
  module: ModuleName
  is_enabled: boolean
  created_at: string
  updated_at: string
}

export interface OrgCalculatorConfig {
  id: string
  org_id: string
  calculator_type: CalculatorType
  is_enabled: boolean
  created_at: string
  updated_at: string
}

export interface OrgPricingConfig {
  id: string
  org_id: string
  config_key: string
  config_value: string | null
  updated_at: string
  updated_by: string | null
}

// ---- System ----

export interface Notification {
  id: string
  org_id: string | null
  user_id: string
  type: string
  title: string
  message: string | null
  read: boolean
  entity_type: string | null
  entity_id: string | null
  created_at: string
}

export interface AuditLog {
  id: string
  org_id: string | null
  user_id: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  details: Record<string, unknown>
  created_at: string
}

export interface EntityLink {
  id: string
  from_entity: string
  from_id: string
  to_entity: string
  to_id: string
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
  user_role: string | null
  is_global_admin: boolean
  user_types: string[]
}
