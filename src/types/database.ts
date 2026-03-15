// ============================================================
// PANTERAY — Database Types (mirrors Supabase schema)
// Phase 5: Customer, Vendor, Subcontractor, Opportunity,
// polymorphic entities, Huddle, and CRM Lead types
// ============================================================

import type {
  UserRole, UserDivision, UserType, ModuleName, CalculatorType,
  OppStatus, OppType, CustomerType, CustomerTier, VendorType, SubWorkType,
  PeerHuddleRole, PeerHuddleVertical, PeerHuddleType,
  LeadStatus, LeadSource, LeadPriority, LeadArchiveReason,
  InteractionType, InteractionDirection,
} from './enums'

// ---- Core Tables (Phase 1) ----

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

export interface GlobalManagerAssignment {
  id: string
  user_id: string
  org_id: string
  created_at: string
}

export interface JWTClaims {
  org_id: string | null
  user_role: string | null
  is_global_admin: boolean
  user_types: string[]
}

// ============================================================
// Phase 5 — Revenue Engine + CRM + Huddle
// ============================================================

// ---- Customer Management (Section 11.4) ----

export interface Customer {
  id: string
  org_id: string
  name: string
  customer_number: string | null
  official_business_name: string | null
  entity_type: string
  customer_type: CustomerType | null
  tier: CustomerTier | null
  status: string | null
  tier_priority: number | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  address: string | null
  state: string | null
  telephone: string | null
  primary_website: string | null
  payment_address: string | null
  payment_city: string | null
  payment_state: string | null
  payment_zip: string | null
  territory: string | null
  region: string | null
  region_state: string | null
  setup_required: boolean
  setup_complete: boolean
  onboarding_status: string | null
  onboarding_health_score: number | null
  overall_score: number | null
  onboarded_by: string | null
  target_go_live_date: string | null
  referral_source: string | null
  pain_points: string | null
  success_metric_goal: string | null
  contract_start_date: string | null
  contract_renewal_date: string | null
  current_tech_stack: string | null
  w9_received: boolean
  doc_signed_contract: boolean
  doc_licenses: boolean
  tin_ein: string | null
  payment_terms: string | null
  accepted_payment_methods: string[]
  late_fee_policy: string | null
  invoicing_contact: string | null
  site_access_notes: string | null
  tax_exempt: boolean
  emergency_contact: string | null
  mac_serial_inventory_link: string | null
  last_audit_date: string | null
  audit_note: string | null
  service_states: string[]
  payment_behavior_score: number | null
  response_time_score: number | null
  delay_frequency_score: number | null
  ease_of_working_score: number | null
  signature_timeframe_score: number | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CustomerInventory {
  id: string
  org_id: string
  customer_id: string
  opp_id: string | null
  serial_number: string | null
  install_location: string | null
  install_date: string | null
  warranty_end_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// ---- Vendor Management (Section 11.5) ----

export interface Vendor {
  id: string
  org_id: string
  vendor_number: string | null
  name: string
  official_business_name: string | null
  entity_type: string
  status: string | null
  product_category: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  website: string | null
  primary_website: string | null
  support_email: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  region: string | null
  region_state: string | null
  is_ndaa_compliant: boolean
  rma_contact_name: string | null
  rma_policy: string | null
  rma_support_phone: string | null
  rma_portal_link: string | null
  warranty_policy_link: string | null
  support_portal_login: string | null
  org_procurement_lead: string | null
  preferred_vendor: boolean
  api_integration_available: boolean
  price_list_uploaded: boolean
  lead_time_avg_days: number | null
  standard_shipping_method: string | null
  shipping_account_number: string | null
  last_price_update_date: string | null
  payment_terms: string | null
  credit_limit: number | null
  discount_tier: string | null
  partner_level: string | null
  partner_discount_pct: number | null
  tin_ein: string | null
  accepted_payment_methods: string[]
  late_fee_policy: string | null
  invoicing_contact: string | null
  e_verified: boolean
  w9_received: boolean
  doc_signed_contract: boolean
  doc_licenses: boolean
  onboarding_status: string | null
  onboarding_health_score: number | null
  overall_score: number | null
  onboarded_by: string | null
  disciplines: string[]
  service_states: string[]
  last_audit_date: string | null
  audit_note: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface VendorTypeRecord {
  id: string
  vendor_id: string
  type: VendorType
  created_at: string
}

export interface VendorContact {
  id: string
  vendor_id: string
  role: string | null
  name: string | null
  email: string | null
  phone: string | null
  notes: string | null
  created_at: string
}

// ---- Subcontractor Management (Section 11.6) ----

export interface Subcontractor {
  id: string
  org_id: string
  sub_number: string | null
  name: string
  official_business_name: string | null
  entity_type: string
  type: string | null
  status: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  po_email: string | null
  address: string | null
  state: string | null
  territory: string | null
  region: string | null
  region_state: string | null
  org_contact: string | null
  license_number: string | null
  setup_required: boolean
  setup_complete: boolean
  onboarding_status: string | null
  onboarding_health_score: number | null
  overall_score: number | null
  onboarded_by: string | null
  e_verified: boolean
  w9_received: boolean
  insurance_certs: boolean
  sub_agreement_signed: boolean
  doc_signed_contract: boolean
  doc_licenses: boolean
  coi_expiration_date: string | null
  workers_comp_expiry: string | null
  general_liability_expiry: string | null
  background_check_status: string | null
  safety_rating_emr: number | null
  approval_av_manager: boolean
  approval_net_manager: boolean
  approval_sec_manager: boolean
  experience_skills_certs: string | null
  certified_brands: string[]
  government_labor_provider: boolean
  gov_labor_categories: string[]
  gov_labor_states: string[]
  hourly_rate: number | null
  day_rate: number | null
  tin_ein: string | null
  payment_terms: string | null
  accepted_payment_methods: string[]
  late_fee_policy: string | null
  invoicing_contact: string | null
  payment_address: string | null
  payment_city: string | null
  payment_state: string | null
  payment_zip: string | null
  preferred_toolset: string | null
  is_preferred: boolean
  is_active: boolean
  timeliness_score: number | null
  qc_pass_rate: number | null
  rework_count: number
  report_cadence_score: number | null
  daily_task_completion: number | null
  revisit_count: number
  service_states: string[]
  last_audit_date: string | null
  audit_note: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface SubcontractorTypeRecord {
  id: string
  subcontractor_id: string
  type: SubWorkType
  created_at: string
}

export interface SubcontractorContact {
  id: string
  subcontractor_id: string
  role: string | null
  name: string | null
  email: string | null
  phone: string | null
  notes: string | null
  created_at: string
}

export interface SubcontractorLicensedState {
  id: string
  subcontractor_id: string
  state: string
  created_at: string
}

// ---- Polymorphic Entity Tables (Section 11.3) ----

export type EntityType = 'customer' | 'vendor' | 'subcontractor'
export type DocType = 'w9' | 'contract' | 'insurance' | 'license' | 'other'

export interface Contact {
  id: string
  org_id: string
  entity_type: EntityType
  entity_id: string
  name: string
  title: string | null
  phone: string | null
  email: string | null
  is_primary: boolean
  notes: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface EntityAddress {
  id: string
  org_id: string
  entity_type: EntityType
  entity_id: string
  label: string
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  is_primary: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface EntityDocument {
  id: string
  org_id: string
  entity_type: EntityType
  entity_id: string
  file_name: string
  storage_path: string
  doc_type: DocType
  uploaded_by: string | null
  created_at: string
}

export interface EntityLicense {
  id: string
  org_id: string
  entity_type: EntityType
  entity_id: string
  license_number: string | null
  license_type: string | null
  issuing_state: string | null
  expiry_date: string | null
  created_by: string | null
  created_at: string
}

// ---- Revenue Engine — Opportunities (Section 11.7) ----

export interface Opportunity {
  id: string
  org_id: string
  opp_number: string | null
  project_number: string | null
  status: OppStatus
  opp_type: OppType | null
  customer_id: string | null
  subcontractor_id: string | null
  customer_name: string | null
  project_name: string | null
  system_name: string | null
  install_address: string | null
  state: string | null
  campus_bldg_rm: string | null
  multiple_locations: boolean
  multiple_location_notes: string | null
  project_description: string | null
  notes: string | null
  vertical: string | null
  customer_vertical: CustomerType | null
  labor_requirement: string | null
  erate: boolean
  program_requirements: string | null
  request_type: string | null
  risk_score: number | null
  decline_reason: string | null
  on_hold_reason: string | null
  kill_flag: boolean
  assigned_isr_id: string | null
  assigned_osr_id: string | null
  assigned_presales_id: string | null
  assigned_pm_id: string | null
  created_by: string | null
  territory: string | null
  disciplines: string[]
  date_received: string | null
  date_committed: string | null
  date_due: string | null
  approx_install_date: string | null
  date_scheduled: string | null
  survey_date: string | null
  survey_date_done: string | null
  design_date_done: string | null
  design_status: string | null
  ready_for_quoting: boolean
  quoting_process_status: string | null
  quoting_status_group: string | null
  quoting_status: string | null
  quoting_date_done: string | null
  quote_expected_date: string | null
  quote_sent_date: string | null
  quote_number: string | null
  quote_amount: number | null
  reason_quote_not_approved: string | null
  reminder_request: string | null
  poc_name: string | null
  poc_phone: string | null
  poc_email: string | null
  po_number: string | null
  po_received_at: string | null
  pn_assigned_at: string | null
  sos_received: boolean
  three_pl: string | null
  ship_status: string | null
  actual_equip_delivery_date: string | null
  delivery_aging: number | null
  warehouse_shipping: string | null
  opp_grade: string | null
  complexity_rating: string | null
  internal_services_estimate: number | null
  order_amount: number | null
  equip_cost: number | null
  labor_cost_customer: number | null
  labor_cost_material: number | null
  labor_cost_only: number | null
  misc_bom: number | null
  misc_labor: number | null
  lift_rental: number | null
  programming_cost_customer: number | null
  programming_cost_material: number | null
  ssc_cost_customer: number | null
  ssc_cost_material: number | null
  contingency: number | null
  sub_quote_amount: number | null
  sub_cost_parts_labor: number | null
  hts_tech_cost: number | null
  job_materials_cost: number | null
  misc_job_costs: number | null
  shipping_cost: number | null
  project_balance: number | null
  ssc_yn: boolean
  ssc_status: string | null
  ssc_term_date: string | null
  ssc_duration: string | null
  ssc_forced: boolean
  ssc_charged: number | null
  ssc_finance_invoice: string | null
  block_hours_approved: number | null
  block_hours_used: number | null
  renewal_number: string | null
  contract_type: string | null
  warranty_90day: boolean
  tkt_number: string | null
  service_status: string | null
  field_service_status: string | null
  issue: string | null
  work_performed: string | null
  labor_hours: number | null
  travel_hours: number | null
  invoice_status: string | null
  service_coordinator_notes: string | null
  sub_project_type: string | null
  sub_service_call: string | null
  sub_order_number: string | null
  sub_labor_cost: number | null
  sub_material_cost: number | null
  sub_approval_req: boolean
  sub_pm_approval: boolean
  sub_comments: string | null
  sub_submitted_by_id: string | null
  sub_attn: string | null
  inv_processed: boolean
  project_closed: boolean
  satisfaction_survey_sent: boolean
  created_at: string
  updated_at: string
}

export interface OppTeamMember {
  id: string
  opp_id: string
  user_id: string
  role: UserRole
  org_id: string | null
  created_at: string
}

export interface OppVendor {
  id: string
  org_id: string
  opp_id: string
  vendor_id: string
  added_by: string | null
  notes: string | null
  created_at: string
}

export interface OppStatusHistory {
  id: string
  opp_id: string
  org_id: string
  previous_status: OppStatus | null
  new_status: OppStatus
  changed_by: string | null
  on_hold_reason: string | null
  decline_reason: string | null
  changed_at: string
}

// ---- Huddle System (Section 11.16) ----

export interface OppHuddleThread {
  id: string
  org_id: string
  opp_id: string
  created_at: string
}

export interface OppHuddleMessage {
  id: string
  org_id: string
  thread_id: string
  author_id: string
  message: string
  is_deleted: boolean
  created_at: string
  updated_at: string
}

export interface PeerHuddleThread {
  id: string
  org_id: string
  role: PeerHuddleRole
  vertical: PeerHuddleVertical | null
  work_type: PeerHuddleType | null
  name: string
  created_at: string
}

export interface PeerHuddleMessage {
  id: string
  org_id: string
  thread_id: string
  author_id: string
  message: string
  is_deleted: boolean
  created_at: string
  updated_at: string
}

export interface HuddleMention {
  id: string
  org_id: string
  mentioned_user_id: string
  opp_message_id: string | null
  peer_message_id: string | null
  is_read: boolean
  created_at: string
}

// ---- CRM Lead Module (from CRM Lead Module Scope doc) ----

export interface Lead {
  id: string
  org_id: string
  lead_number: string | null
  status: LeadStatus
  source: LeadSource | null
  source_detail: string | null
  company_name: string | null
  contact_first_name: string
  contact_last_name: string
  contact_title: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_mobile: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  primary_website: string | null
  vertical: CustomerType | null
  interest_divisions: string[] | null
  estimated_value: number | null
  priority: LeadPriority
  score: number | null
  assigned_to: string | null
  referred_by: string | null
  pain_points: string | null
  notes: string | null
  card_scan_image_url: string | null
  card_scan_raw: Record<string, unknown> | null
  converted_customer_id: string | null
  converted_opp_id: string | null
  converted_at: string | null
  converted_by: string | null
  archive_reason: LeadArchiveReason | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface LeadInteraction {
  id: string
  org_id: string
  lead_id: string
  type: InteractionType
  direction: InteractionDirection | null
  subject: string | null
  body: string | null
  outcome: string | null
  interaction_date: string
  duration_minutes: number | null
  follow_up_date: string | null
  follow_up_note: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface LeadMeeting {
  id: string
  org_id: string
  lead_id: string | null
  opp_id: string | null
  title: string
  description: string | null
  location: string | null
  start_time: string
  end_time: string
  attendees: Record<string, unknown>[]
  calendar_provider: string | null
  calendar_event_id: string | null
  sync_status: string | null
  outcome: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface UserCredential {
  id: string
  org_id: string
  user_id: string
  provider: string
  credentials: Record<string, unknown>
  created_at: string
  updated_at: string
}
