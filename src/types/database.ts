// ============================================================
// PANTERAY — Database Types (mirrors Supabase schema)
// Phase 5: Customer, Manufacturer, Subcontractor, Opportunity,
// polymorphic entities, Huddle, and CRM Lead types
// ============================================================

import type {
  UserRole, UserDivision, UserType, ModuleName, CalculatorType,
  OppStatus, OppType, CustomerType, CustomerTier, ManufacturerType, SubWorkType,
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

// ---- Manufacturer Management (Section 11.5) ----

export interface Manufacturer {
  id: string
  org_id: string
  manufacturer_number: string | null
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
  preferred_manufacturer: boolean
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

export interface ManufacturerTypeRecord {
  id: string
  manufacturer_id: string
  type: ManufacturerType
  created_at: string
}

export interface ManufacturerContact {
  id: string
  manufacturer_id: string
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
  compliance_hold: boolean
  compliance_hold_reason: string | null
  compliance_recalc_at: string | null
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

export type EntityType = 'customer' | 'manufacturer' | 'subcontractor' | 'opportunity' | 'distributor'
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

export interface OppManufacturer {
  id: string
  org_id: string
  opp_id: string
  manufacturer_id: string
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

// ============================================================
// Phase 5D — Distributors + Material Tracking
// ============================================================

export interface Distributor {
  id: string
  org_id: string
  distributor_number: string | null
  name: string
  account_number: string | null
  rep_name: string | null
  rep_email: string | null
  rep_phone: string | null
  website: string | null
  portal_login: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  region: string | null
  region_state: string | null
  payment_terms: string | null
  shipping_methods: string[]
  credit_limit: number | null
  discount_tier: string | null
  is_preferred: boolean
  is_active: boolean
  notes: string | null
  status: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface OppDistributor {
  id: string
  org_id: string
  opp_id: string
  distributor_id: string
  quote_number: string | null
  quote_date: string | null
  quote_amount: number | null
  status: string
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface OppMaterialTracking {
  id: string
  org_id: string
  opp_id: string
  line_number: string | null
  distributor_id: string | null
  manufacturer_id: string | null
  item_description: string
  part_number: string | null
  quantity: number
  unit_cost: number | null
  extended_cost: number | null
  order_number: string | null
  tracking_number: string | null
  carrier: string | null
  ship_status: string
  date_ordered: string | null
  estimated_delivery_date: string | null
  actual_delivery_date: string | null
  ship_to_address: string | null
  ship_to_city: string | null
  ship_to_state: string | null
  ship_to_zip: string | null
  warehouse_location: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// ============================================================
// DEVICE LIBRARY (Phase 6 — Section 11.9)
// ============================================================

export interface DeviceLibraryItem {
  id: string
  org_id: string | null // NULL = global platform item
  vendor: string
  model: string
  partnumber: string | null
  category: string // device_category enum
  subcategory: string | null
  resolution: string | null
  fps: string | null
  poe_standard: string | null
  wattage: number | null
  ndaa_compliant: boolean
  ul_listed: boolean
  ul_listing_code: string | null
  form: string | null
  ir: string | null
  super_low_light: boolean | null
  focal_length: string | null
  focal_type: string | null
  aov: string | null
  imager_count: number | null
  multi_imager_type: string | null
  codecs: string | null
  fisheye_view: string | null
  environment: string | null
  specs: Record<string, unknown> // JSONB — category-specific fields
  manufacturer_id: string | null // FK → device_library_manufacturers
  created_at: string
  updated_at: string
}

export interface DeviceLibraryManufacturer {
  id: string
  org_id: string | null // NULL = global
  name: string
  ndaa_status: string // ndaa_status enum: compliant | non_compliant | mixed | unverified
  ndaa_notes: string | null
  website: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface DeviceLibraryContribution {
  id: string
  org_id: string
  submitted_by: string | null
  device_item_id: string // FK → device_library_items
  status: string // contribution_status enum
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  merged_into_id: string | null // FK → device_library_items
  created_at: string
}


/** Shape returned by device library search API */
export interface DeviceSearchResult {
  id: string
  category: string
  subcategory: string | null
  vendor: string
  model: string
  partnumber: string | null
  resolution: string | null
  fps: string | null
  ndaa_compliant: boolean | null
  ul_listed: boolean | null
  ul_listing_code: string | null
  form: string | null
  ir: string | null
  super_low_light: boolean | null
  focal_length: string | null
  focal_type: string | null
  aov: string | null
  imager_count: number | null
  multi_imager_type: string | null
  codecs: string | null
  fisheye_view: string | null
  environment: string | null
  specs: Record<string, unknown> | null
  wattage: number | null
  poe_standard: string | null
  manufacturer_id: string | null
}

// ============================================================
// ENGINEERING ENGINE — DESIGN CANVAS (Phase 7 — Section 11.8)
// ============================================================

export interface Design {
  id: string
  org_id: string | null
  opp_id: string | null
  created_by: string | null
  name: string
  status: string // text, default 'ACTIVE'
  created_at: string
  updated_at: string
}

export interface DesignCanvas {
  id: string
  org_id: string
  opp_id: string | null
  name: string
  status: string // design_canvas_status_enum
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface DesignArea {
  id: string
  design_id: string
  org_id: string | null
  canvas_id: string | null
  name: string
  canvas_type: string // canvas_area_type enum
  floor_plan_image_ref: string | null
  floor_plan_url_legacy: string | null
  scale_calibration: number | null
  infrastructure_observations: Record<string, unknown> | null
  satellite_lat: number | null
  satellite_lng: number | null
  satellite_zoom: number
  sort_order: number | null
  created_at: string
}

export interface DesignFloorPlan {
  id: string
  design_id: string
  area_id: string
  canvas_id: string | null
  file_url: string | null
  width: number | null
  height: number | null
  opacity: number
  created_at: string
}

export interface DesignDevice {
  id: string
  org_id: string
  design_id: string
  area_id: string | null
  canvas_id: string | null
  device_library_item_id: string | null
  category: string // device_category enum
  label: string
  position_x: number
  position_y: number
  status: string // device_status enum
  condition: string | null // condition_type enum
  mount_type: string | null
  color_hex: string | null
  rotation: number
  properties: Record<string, unknown> | null
  asset_type: string
  billing_type: string
  recurring_cost: number
  zone_id: string | null
  created_at: string
  updated_at: string
}

export interface DesignCable {
  id: string
  design_id: string
  area_id: string | null
  canvas_id: string | null
  org_id: string | null
  cable_type: string // cable_type enum
  label: string | null
  waypoints: Array<{ x: number; y: number }>
  length_ft: number
  slack_pct: number
  total_length_ft: number
  service_loop_ft: number
  from_device_id: string | null
  to_device_id: string | null
  mdf_idf_id: string | null
  color_hex: string | null
  created_at: string
  updated_at: string
}

export interface DesignMdfIdf {
  id: string
  design_id: string
  area_id: string | null
  canvas_id: string | null
  org_id: string | null
  name: string
  position_x: number
  position_y: number
  color_hex: string | null
  service_loop_ft: number
  location_description: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface DesignWall {
  id: string
  design_id: string
  area_id: string | null
  org_id: string | null
  name: string
  points: Array<{ x: number; y: number }>
  wall_type: string
  height_ft: number
  opacity: number
  color: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface DesignZone {
  id: string
  design_id: string
  org_id: string | null
  name: string
  color: string
  x: number
  y: number
  width: number
  height: number
  errors?: { [key: string]: string }
  created_at: string
  updated_at: string
}

export interface DesignRackSlots {
  id: string
  org_id: string
  design_id: string
  area_id: string | null
  rack_name: string
  rack_color_hex: string | null
  rack_location: string | null
  mdf_idf_id: string | null
  total_u: number
  slots: Array<{
    u_position: number
    device_id: string | null
    device_name: string | null
    ru_height: number
    poe_draw_w: number
    power_draw_w: number
    is_blank: boolean
    is_patch_panel: boolean
  }>
  created_at: string
  updated_at: string
}

export interface DesignVlanSubnet {
  id: string
  org_id: string
  design_id: string
  vlan_id: number
  vlan_name: string | null
  subnet: string | null
  gateway: string | null
  dhcp_range_start: string | null
  dhcp_range_end: string | null
  notes: string | null
  canvas_type: string
  created_at: string
  updated_at: string
}

export interface DesignAvoipDevice {
  id: string
  org_id: string
  design_id: string
  device_id: string | null
  device_name: string | null
  protocol: string // avoip_protocol enum
  ip_address: string | null
  subnet: string | null
  vlan_id: string | null
  nic_type: string // avoip_nic_type enum
  latency_setting: number | null
  multicast: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface DesignTopologyNode {
  id: string
  org_id: string
  design_id: string
  node_type: string // topology_node_type enum
  label: string
  position_x: number
  position_y: number
  layer: string // topology_layer enum
  properties: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface DesignTopologyLink {
  id: string
  org_id: string
  design_id: string
  from_node_id: string
  to_node_id: string
  cable_type: string | null
  speed: string | null // topology_speed enum
  vlan_tags: string[]
  is_trunk: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface InterconnectNode {
  id: string
  design_id: string
  node_type: string
  label: string
  properties: Record<string, unknown>
  created_at: string
}

export interface InterconnectLink {
  id: string
  design_id: string
  from_node_id: string
  to_node_id: string
  link_type: string
  properties: Record<string, unknown>
  created_at: string
}

export interface DoorConfig {
  id: string
  org_id: string
  design_id: string
  area_id: string | null
  canvas_id: string | null
  device_id: string | null
  label: string | null
  door_type: string
  lock_type: string
  reader_in_type: string
  reader_out_type: string
  has_rex: boolean
  has_door_contact: boolean
  has_auto_operator: boolean
  controller_device_id: string | null
  x: number | null
  y: number | null
  notes: string | null
  properties: Record<string, unknown>
  created_at: string
  updated_at: string
}

// ============================================================
// CUSTOMER PORTAL (Phase 1E)
// ============================================================

export interface CustomerPortalToken {
  id: string
  org_id: string
  opp_id: string
  customer_id: string
  token: string
  permissions: string[]
  is_active: boolean
  expires_at: string
  accepted_at: string | null
  accepted_by_name: string | null
  accepted_by_email: string | null
  signature_data: string | null
  ip_address: string | null
  user_agent: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// ============================================================
// SUBCONTRACTOR RFP & LABOR QUOTING (Phase 1D)
// ============================================================

export interface OppSubQuote {
  id: string
  org_id: string
  opp_id: string
  sub_id: string
  status: 'draft' | 'rfp_sent' | 'quoted' | 'accepted' | 'rejected' | 'expired'
  rfp_notes: string | null
  labor_hours: number | null
  labor_amount: number | null
  material_amount: number | null
  total_amount: number | null
  quote_doc_url: string | null
  rfp_sent_at: string | null
  quote_received_at: string | null
  accepted_at: string | null
  accepted_by: string | null
  decline_reason: string | null
  valid_until: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// ============================================================
// SURVEY MODULE (Phase 1C)
// ============================================================

export interface Survey {
  id: string
  org_id: string
  opp_id: string | null
  site_name: string
  site_address: string | null
  customer_name: string | null
  surveyor_id: string | null
  surveyor_name: string | null
  survey_date: string | null
  status: 'draft' | 'in_progress' | 'submitted'
  site_notes: string | null
  infrastructure_notes: string | null
  synced: boolean
  synced_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface SurveyFloorPlan {
  id: string
  survey_id: string
  org_id: string
  name: string
  mode: 'floorplan' | 'satellite' | 'grid' | 'photos_only'
  image_url: string | null
  image_width: number | null
  image_height: number | null
  satellite_lat: number | null
  satellite_lng: number | null
  satellite_zoom: number
  scale_px_per_ft: number | null
  display_order: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface SurveyDevice {
  id: string
  survey_id: string
  floor_plan_id: string | null
  org_id: string
  system_type: string
  device_type: string
  label: string
  status: 'new' | 'existing_keep' | 'existing_remove' | 'relocate'
  condition: 'good' | 'fair' | 'poor' | 'unknown' | null
  existing_make_model: string | null
  location_description: string | null
  vendor: string | null
  model: string | null
  resolution: string | null
  mount_type: string | null
  mount_height_in: number | null
  cable_type: string | null
  cable_run_ft: number | null
  color_hex: string | null
  fov_angle: number | null
  fov_rotation: number | null
  notes: string | null
  position_x: number
  position_y: number
  detection_capabilities: Record<string, boolean>
  alert_destination: string | null
  integration_method: string | null
  relay_output: string | null
  power_source: string | null
  door_config: Record<string, unknown>
  wptp_pair_id: string | null
  created_at: string
  updated_at: string
}

export interface SurveyInfrastructure {
  id: string
  survey_id: string
  floor_plan_id: string | null
  org_id: string
  type: 'mdf' | 'idf' | 'conduit' | 'fiber' | 'power' | 'other'
  name: string
  mdf_idf_locations: string | null
  conduit_pathway: string | null
  power_availability: string | null
  network_infrastructure: string | null
  location: string | null
  notes: string | null
  photos: unknown[]
  created_at: string
  updated_at: string
}

export interface SurveyPhoto {
  id: string
  survey_id: string
  device_id: string | null
  infra_id: string | null
  org_id: string
  storage_url: string
  caption: string | null
  lat: number | null
  lng: number | null
  taken_at: string | null
  created_at: string
}

export interface SurveyCable {
  id: string
  survey_id: string
  floor_plan_id: string | null
  org_id: string
  label: string
  cable_type: string | null
  color_hex: string | null
  slack_pct: number | null
  polyline: [number, number][]
  length_ft: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

// ============================================================
// WIFI HEATMAP (Phase 2E)
// ============================================================

export interface DesignWifiAp {
  id: string
  org_id: string
  design_id: string
  area_id: string | null
  canvas_id: string | null
  ap_model: string | null
  vendor: string | null
  band: string
  channel: number | null
  channel_width: number
  tx_power_dbm: number
  antenna_gain_dbi: number
  mount_height_ft: number
  environment: string
  position_x: number
  position_y: number
  label: string
  color_hex: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface JurisdictionRuleset {
  id: string
  org_id: string | null
  jurisdiction: string
  rule_code: string
  rule_category: string
  severity: 'HIGH' | 'MED' | 'LOW' | 'INFO'
  title: string
  description: string
  fix_hint: string | null
  applies_to: string[]
  conditions: Record<string, unknown>
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CalculatorResult {
  id: string
  org_id: string
  opp_id: string | null
  design_id: string | null
  type: string // calculator_type enum
  input_data: Record<string, unknown>
  result_data: Record<string, unknown>
  created_by: string | null
  created_at: string
}

export interface VaultArtifact {
  id: string
  org_id: string
  design_id: string
  artifact_type: string | null
  file_name: string | null
  storage_path: string | null
  file_size_bytes: number | null
  created_by: string | null
  created_at: string
}

// ---- Delivery Engine (Phase 3) ----

export interface Project {
  id: string
  org_id: string
  opp_id: string | null
  pn: string | null
  name: string
  pm_id: string | null
  status: 'planning' | 'active' | 'on_hold' | 'punch_list' | 'closeout' | 'completed' | 'cancelled'
  risk_score: number
  risk_level: string | null
  contingency_pct: number
  site_address: string | null
  site_city: string | null
  site_state: string | null
  site_zip: string | null
  site_notes: string | null
  start_date: string | null
  target_end_date: string | null
  actual_end_date: string | null
  budget_amount: number | null
  customer_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ProjectTask {
  id: string
  org_id: string
  project_id: string
  title: string
  description: string | null
  assignee_id: string | null
  status: 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled'
  priority: string
  area_id: string | null
  due_date: string | null
  completed_at: string | null
  sort_order: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ProjectMilestone {
  id: string
  org_id: string
  project_id: string
  title: string
  description: string | null
  target_date: string | null
  completed_at: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ProjectTeam {
  id: string
  org_id: string
  project_id: string
  user_id: string
  role: 'PM' | 'LEAD_TECH' | 'FIELD_TECH' | 'SUB' | 'PRESALES' | 'ENGINEER'
  added_at: string
}

export interface DailyReport {
  id: string
  org_id: string
  project_id: string
  report_date: string
  author_id: string
  summary: string | null
  weather: string | null
  crew_count: number
  hours_worked: number
  safety_notes: string | null
  photos: Array<{ url: string; caption?: string; taken_at?: string }>
  created_at: string
  updated_at: string
}

export interface DailyReportItem {
  id: string
  org_id: string
  report_id: string
  task_id: string | null
  description: string
  hours: number
  photos: Array<{ url: string; caption?: string }>
  created_at: string
}

export interface InstallItem {
  id: string
  org_id: string
  project_id: string
  device_id: string | null
  area_id: string | null
  hw_schedule_line: number | null
  label: string
  category: string | null
  description: string | null
  vendor: string | null
  model: string | null
  quantity: number
  status: 'planned' | 'installation_requested' | 'installed' | 'in_review' | 'deviation'
  match_status?: 'green' | 'red' | null
  installed_by: string | null
  installed_at: string | null
  serial_number: string | null
  mac_address: string | null
  deviation_type: 'minor' | 'major' | null
  deviation_note: string | null
  deviation_ai_analysis: string | null
  position_x: number | null
  position_y: number | null
  photos: Array<{ url: string; caption?: string; phase?: string; taken_at?: string }>
  created_at: string
  updated_at: string
}

export interface InventoryTxn {
  id: string
  org_id: string
  project_id: string
  user_id: string
  item_description: string
  part_number: string | null
  type: 'DEBIT' | 'CREDIT'
  quantity: number
  notes: string | null
  created_at: string
}

// ---- Delivery Engine V2 (Phase 4) ----

export interface ChangeOrder {
  id: string
  org_id: string
  project_id: string
  co_number: string | null
  type: 'minor' | 'major'
  status: 'initiated' | 'classified' | 'engineering_delegated' | 'quote_delegated' | 'pm_review' | 'customer_sig' | 'injected' | 'field_acknowledged' | 'closed'
  title: string
  description: string | null
  reason: string | null
  cost_impact: number
  price_change: boolean
  schedule_impact_days: number
  install_item_id: string | null
  initiated_by: string | null
  engineering_assignee_id: string | null
  engineering_notes: string | null
  engineering_completed_at: string | null
  quote_assignee_id: string | null
  quote_amount: number | null
  quote_notes: string | null
  quote_completed_at: string | null
  pm_approved_by: string | null
  pm_approved_at: string | null
  pm_decline_reason: string | null
  customer_signed_at: string | null
  customer_sig_data: string | null
  injected_at: string | null
  field_acknowledged_by: string | null
  field_acknowledged_at: string | null
  closed_at: string | null
  closed_by: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface RaidItem {
  id: string
  org_id: string
  project_id: string
  type: 'RISK' | 'ACTION' | 'ISSUE' | 'DECISION'
  raid_number: string | null
  title: string
  description: string | null
  status: 'open' | 'in_progress' | 'ongoing' | 'on_track' | 'needs_review' | 'approved' | 'overdue' | 'on_hold' | 'resolved' | 'closed'
  probability: number | null
  impact: number | null
  risk_rating: number | null
  response_type: string | null
  response_actions: string | null
  assigned_to: string | null
  due_date: string | null
  completed_at: string | null
  severity: string | null
  resolution: string | null
  decision_maker: string | null
  decision_date: string | null
  rationale: string | null
  category: string | null
  owner_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface QcChecklist {
  id: string
  org_id: string
  project_id: string
  area_id: string | null
  area_name: string | null
  status: 'draft' | 'in_progress' | 'submitted' | 'approved' | 'failed'
  items: Array<{ id: string; label: string; passed: boolean; notes?: string; photo_before_url?: string; photo_after_url?: string }>
  corrective_actions: Array<{ id: string; description: string; assigned_to?: string; status?: string; due_date?: string; completed_at?: string }>
  submitted_by: string | null
  submitted_at: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  photos: Array<{ url: string; caption?: string; phase?: string }>
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface SignOffSheet {
  id: string
  org_id: string
  project_id: string
  status: 'draft' | 'pending_customer' | 'pending_sub' | 'pending_pm' | 'completed'
  scope_summary: string | null
  customer_name: string | null
  customer_title: string | null
  customer_sig_data: string | null
  customer_signed_at: string | null
  sub_name: string | null
  sub_sig_data: string | null
  sub_signed_at: string | null
  pm_name: string | null
  pm_sig_data: string | null
  pm_signed_at: string | null
  photos: Array<{ url: string; caption?: string }>
  gate_install_complete: boolean
  gate_co_closed: boolean
  gate_qc_passed: boolean
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface StatusReport {
  id: string
  org_id: string
  project_id: string
  report_date: string
  overall_status: 'on_track' | 'at_risk' | 'behind' | 'critical'
  summary: string | null
  accomplishments: string | null
  next_steps: string | null
  blockers: string | null
  snapshot: Record<string, unknown>
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface LessonLearned {
  id: string
  org_id: string
  project_id: string
  practice_area: string
  issue_category: string
  subcategory: string | null
  what_happened: string
  impact: string | null
  recommendation: string | null
  severity: string
  status: string
  reviewed_by: string | null
  reviewed_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface StakeholderEntry {
  id: string
  org_id: string
  project_id: string
  name: string
  role: string | null
  organization: string | null
  category: 'internal' | 'external'
  power: number
  influence: number
  interest: number
  email: string | null
  phone: string | null
  communication_preference: string | null
  communication_frequency: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface MeetingMinutes {
  id: string
  org_id: string
  project_id: string
  meeting_type: string
  title: string
  meeting_date: string
  location: string | null
  attendees: Array<{ name: string; role?: string; present?: boolean }>
  agenda: string | null
  discussion_notes: string | null
  action_items: Array<{ description: string; assigned_to?: string; due_date?: string; status?: string }>
  decisions: Array<{ description: string; decided_by?: string; rationale?: string }>
  next_meeting_date: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// ---- Subcontractor Portal + Risk (Phase 4D/4E) ----

export type SubAssignmentStatus =
  | 'rfp_sent' | 'quoted' | 'quote_review' | 'quote_accepted'
  | 'po_issued' | 'po_acknowledged' | 'mobilizing' | 'on_site'
  | 'in_progress' | 'blocked' | 'daily_report_pending' | 'qc_pending'
  | 'punch_list' | 'punch_complete' | 'invoice_pending' | 'invoice_received'
  | 'subcontractor_complete'

export interface SubAssignment {
  id: string
  org_id: string
  project_id: string
  sub_id: string
  status: SubAssignmentStatus
  scope: string | null
  deliverables: string | null
  po_number: string | null
  po_amount: number | null
  invoiced_amount: number
  paid_amount: number
  start_date: string | null
  target_end_date: string | null
  actual_end_date: string | null
  rfp_sent_at: string | null
  quoted_at: string | null
  po_issued_at: string | null
  mobilized_at: string | null
  completed_at: string | null
  opp_sub_quote_id: string | null
  pm_assignee_id: string | null
  notes: string | null
  blockers: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface SubPortalToken {
  id: string
  org_id: string
  sub_id: string
  project_id: string
  token: string
  permissions: string[]
  is_active: boolean
  expires_at: string
  accessed_at: string | null
  access_count: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface SubDocument {
  id: string
  org_id: string
  sub_id: string
  doc_type: 'coi' | 'w9' | 'license' | 'bond' | 'msa' | 'nda' | 'safety_cert' | 'other'
  doc_name: string
  storage_url: string | null
  file_size_bytes: number | null
  issued_date: string | null
  expires_at: string | null
  policy_number: string | null
  carrier: string | null
  coverage_amount: number | null
  is_active: boolean
  notes: string | null
  uploaded_by: string | null
  created_at: string
  updated_at: string
}

export interface SubSkillMatrix {
  id: string
  org_id: string
  sub_id: string
  technical_skills: Record<string, number>
  soft_skills: Record<string, number>
  certifications: Record<string, boolean>
  territory: string[]
  approved_practices: string[]
  notes: string | null
  last_updated_by: string | null
  created_at: string
  updated_at: string
}

export interface RiskCategoryScore {
  probability: number
  impact: number
  score: number
  notes: string
}

export interface RiskCategoryMitigation {
  strategy?: 'avoid' | 'mitigate' | 'transfer' | 'accept'
  action?: string
  owner_id?: string
  residual?: number
}

export interface RiskAssessment {
  id: string
  org_id: string
  project_id: string
  technical: RiskCategoryScore
  schedule: RiskCategoryScore
  cost: RiskCategoryScore
  scope: RiskCategoryScore
  team: RiskCategoryScore
  technical_mitigation: RiskCategoryMitigation
  schedule_mitigation: RiskCategoryMitigation
  cost_mitigation: RiskCategoryMitigation
  scope_mitigation: RiskCategoryMitigation
  team_mitigation: RiskCategoryMitigation
  total_risk_score: number
  residual_risk_score: number
  overall_risk_level: 'low' | 'medium' | 'high' | 'critical'
  status: 'draft' | 'stage_1_complete' | 'stage_2_complete' | 'approved'
  approved_by: string | null
  approved_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// ---- Asset Intelligence (Phase 5) ----

export type AssetStatus = 'active' | 'maintenance' | 'retired' | 'rma' | 'lost' | 'replaced'
export type AssetMaintenanceType = 'preventive' | 'repair' | 'inspection' | 'firmware_update' | 'cleaning' | 'calibration'
export type AssetEventType =
  | 'installed' | 'serviced' | 'firmware_updated' | 'relocated'
  | 'retired' | 'rma_initiated' | 'replaced' | 'reactivated'
  | 'inspection_passed' | 'inspection_failed'

export interface Asset {
  id: string
  org_id: string
  project_id: string | null
  install_item_id: string | null
  device_id: string | null
  customer_id: string | null
  site_id: string | null
  asset_tag: string | null
  label: string
  category: string | null
  vendor: string | null
  model: string | null
  serial_number: string | null
  mac_address: string | null
  status: AssetStatus
  install_date: string | null
  warranty_start: string | null
  warranty_expires_at: string | null
  eol_date: string | null
  retired_at: string | null
  firmware_version: string | null
  ip_address: string | null
  location_notes: string | null
  position_x: number | null
  position_y: number | null
  photos: Array<{ url: string; caption?: string; taken_at?: string }>
  specs: Record<string, unknown>
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface AssetFirmwareHistory {
  id: string
  org_id: string
  asset_id: string
  version: string
  previous_version: string | null
  updated_at: string
  updated_by: string | null
  notes: string | null
  cve_fixes: string[] | null
}

export interface AssetMaintenance {
  id: string
  org_id: string
  asset_id: string
  type: AssetMaintenanceType
  scheduled_at: string | null
  completed_at: string | null
  completed_by: string | null
  technician_notes: string | null
  cost: number | null
  parts_used: Array<{ part_number?: string; description?: string; quantity?: number; cost?: number }>
  photos: Array<{ url: string; caption?: string }>
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface AssetLifecycleEvent {
  id: string
  org_id: string
  asset_id: string
  event_type: AssetEventType
  event_at: string
  details: Record<string, unknown>
  user_id: string | null
  created_at: string
}

// ============================================================
// PSA Service Desk (Phase 6A)
// ============================================================

export type PsaVertical = 'SEC' | 'NET' | 'AV' | 'MSP' | 'CYB' | 'SVC' | 'INT'

export type PsaTicketType = 'INCIDENT' | 'SERVICE_REQUEST' | 'SCOPE_CHANGE' | 'CHANGE' | 'PROBLEM' | 'EVENT' | 'INTERNAL'

export type PsaPriority = 'P1' | 'P2' | 'P3' | 'P4' | 'P5'

export type PsaTicketStatus =
  | 'NEW' | 'OPEN' | 'SCHEDULED' | 'EN_ROUTE' | 'ON_SITE' | 'WORK_IN_PROGRESS'
  | 'WAITING_ON_CUSTOMER' | 'WAITING_ON_PARTS' | 'WAITING_ON_VENDOR' | 'WAITING_ON_SITE_ACCESS'
  | 'NEEDS_RMA' | 'COMPLETED' | 'RESOLVED' | 'CANCELLED'

export type PsaSlaEventType = 'CLOCK_START' | 'PAUSE' | 'RESUME' | 'BREACH_RESPONSE' | 'BREACH_RESOLUTION'

export interface PsaSlaPolicy {
  id: string
  org_id: string
  vertical: PsaVertical
  ticket_type: PsaTicketType
  priority: PsaPriority
  response_min: number
  resolution_min: number
  applies_24x7: boolean
  created_at: string
  updated_at: string
}

export interface PsaJobType {
  id: string
  org_id: string
  vertical: PsaVertical
  name: string
  checklist_template: unknown[]
  required_skills: string[]
  default_sla_policy_id: string | null
  auto_tags: string[]
  require_photos: boolean
  estimated_duration_min: number | null
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface PsaTicket {
  id: string
  org_id: string
  ticket_number: string
  customer_id: string | null
  asset_id: string | null
  site_id: string | null
  project_id: string | null
  parent_ticket_id: string | null
  vertical: PsaVertical
  category: string | null
  ticket_type: PsaTicketType
  priority: PsaPriority
  status: PsaTicketStatus
  title: string
  description: string | null
  resolution_notes: string | null
  assigned_to: string | null
  job_type_id: string | null
  costing_enabled: boolean
  sla_policy_id: string | null
  sla_response_due: string | null
  sla_resolution_due: string | null
  sla_response_breached: boolean
  sla_resolution_breached: boolean
  sla_paused_at: string | null
  sla_total_pause_min: number
  change_window_start: string | null
  change_window_end: string | null
  required_skills: string[]
  first_response_at: string | null
  completed_at: string | null
  resolved_at: string | null
  closed_at: string | null
  pir_completed_at: string | null
  pir_root_cause: string | null
  pir_timeline: string | null
  pir_lessons_learned: string | null
  pir_action_items: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PsaTicketStatusLog {
  id: string
  org_id: string
  ticket_id: string
  from_status: PsaTicketStatus | null
  to_status: PsaTicketStatus
  changed_by: string | null
  reason: string | null
  created_at: string
}

export interface PsaTicketNote {
  id: string
  org_id: string
  ticket_id: string
  author_id: string | null
  body: string
  internal_only: boolean
  created_at: string
}

export interface PsaTimeEntry {
  id: string
  org_id: string
  ticket_id: string
  user_id: string
  hours: number
  description: string | null
  billable: boolean
  rate: number | null
  entry_date: string
  created_at: string
  updated_at: string
}

export interface PsaTicketPart {
  id: string
  org_id: string
  ticket_id: string
  part_number: string | null
  description: string
  quantity: number
  cost: number | null
  markup_pct: number | null
  serial_number: string | null
  created_at: string
}

export interface PsaTicketPhoto {
  id: string
  org_id: string
  ticket_id: string
  photo_url: string
  caption: string | null
  phase: string
  created_by: string | null
  created_at: string
}

export interface PsaSlaEvent {
  id: string
  org_id: string
  ticket_id: string
  event_type: PsaSlaEventType
  event_at: string
  duration_paused_min: number | null
  notes: string | null
}

// Status machine: valid transitions per Spec 9.4
export const PSA_STATUS_TRANSITIONS: Record<PsaTicketStatus, PsaTicketStatus[]> = {
  NEW: ['OPEN', 'SCHEDULED', 'CANCELLED'],
  OPEN: ['SCHEDULED', 'EN_ROUTE', 'WORK_IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'WAITING_ON_PARTS', 'WAITING_ON_VENDOR', 'WAITING_ON_SITE_ACCESS', 'CANCELLED'],
  SCHEDULED: ['EN_ROUTE', 'OPEN', 'WAITING_ON_CUSTOMER', 'WAITING_ON_SITE_ACCESS', 'CANCELLED'],
  EN_ROUTE: ['ON_SITE', 'SCHEDULED', 'OPEN', 'CANCELLED'],
  ON_SITE: ['WORK_IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'WAITING_ON_SITE_ACCESS', 'EN_ROUTE'],
  WORK_IN_PROGRESS: ['COMPLETED', 'WAITING_ON_CUSTOMER', 'WAITING_ON_PARTS', 'WAITING_ON_VENDOR', 'NEEDS_RMA', 'ON_SITE'],
  WAITING_ON_CUSTOMER: ['OPEN', 'WORK_IN_PROGRESS', 'CANCELLED'],
  WAITING_ON_PARTS: ['OPEN', 'WORK_IN_PROGRESS', 'CANCELLED'],
  WAITING_ON_VENDOR: ['OPEN', 'WORK_IN_PROGRESS', 'CANCELLED'],
  WAITING_ON_SITE_ACCESS: ['OPEN', 'SCHEDULED', 'EN_ROUTE', 'CANCELLED'],
  NEEDS_RMA: ['OPEN', 'WORK_IN_PROGRESS', 'CANCELLED'],
  COMPLETED: ['RESOLVED', 'WORK_IN_PROGRESS'],
  RESOLVED: [],
  CANCELLED: [],
}

export const PSA_WAITING_STATUSES: PsaTicketStatus[] = [
  'WAITING_ON_CUSTOMER', 'WAITING_ON_PARTS', 'WAITING_ON_VENDOR', 'WAITING_ON_SITE_ACCESS', 'NEEDS_RMA',
]

// ============================================================================
// PSA Dispatch (Phase 6B)
// ============================================================================

export type PsaDispatchStatus =
  | 'scheduled' | 'en_route' | 'on_site' | 'wip' | 'completed' | 'cancelled'

export interface PsaDispatchAssignment {
  id: string
  org_id: string
  ticket_id: string
  tech_id: string
  scheduled_date: string
  scheduled_start: string | null
  scheduled_end: string | null
  status: PsaDispatchStatus
  notes: string | null
  travel_notes: string | null
  geolocation: Record<string, unknown> | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PsaTechAvailability {
  id: string
  org_id: string
  user_id: string
  day_of_week: number
  start_time: string
  end_time: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface PsaTechSkill {
  id: string
  org_id: string
  user_id: string
  skill: string
  proficiency: 'junior' | 'mid' | 'senior'
  created_at: string
}

// Dispatch status → ticket status cascade
export const DISPATCH_TO_TICKET_STATUS: Record<PsaDispatchStatus, PsaTicketStatus | null> = {
  scheduled: 'SCHEDULED',
  en_route: 'EN_ROUTE',
  on_site: 'ON_SITE',
  wip: 'WORK_IN_PROGRESS',
  completed: 'COMPLETED',
  cancelled: null,
}

// ============================================================================
// PSA Job Costing (Phase 6C)
// ============================================================================

export interface PsaUserRate {
  id: string
  org_id: string
  user_id: string
  internal_cost_rate: number
  billable_rate: number
  effective_from: string
  effective_to: string | null
  created_by: string | null
  created_at: string
}

export interface PsaOrgCostConfig {
  id: string
  org_id: string
  overhead_burden_pct: number
  default_parts_markup_pct: number
  created_at: string
  updated_at: string
}

export interface PsaTicketCosting {
  ticket_id: string
  org_id: string
  ticket_number: string
  title: string
  status: PsaTicketStatus
  priority: PsaPriority
  costing_enabled: boolean
  estimated_hours: number | null
  estimated_labor_cost: number | null
  estimated_parts_cost: number | null
  quoted_revenue: number | null
  actual_hours: number
  actual_labor_cost_raw: number
  actual_labor_cost: number
  actual_labor_revenue: number
  actual_parts_cost: number
  actual_parts_revenue: number
  total_cost: number
  total_revenue: number
  gross_margin: number
  gm_pct: number | null
  budget_burn_pct: number | null
}

// ============================================================================
// PSA — Project Costing Rollup (G6 — psa_project_costing_v)
// ============================================================================

export interface PsaProjectCosting {
  project_id: string
  org_id: string
  project_number: string | null
  project_name: string
  project_status: string
  ticket_count: number
  open_ticket_count: number
  actual_hours: number
  estimated_hours: number
  total_cost: number
  total_revenue: number
  gross_margin: number
  gm_pct: number | null
  budget_burn_pct: number | null
}

// ============================================================================
// Asset Relationships — CI dependency graph (G6)
// ============================================================================

export type AssetRelationshipType =
  | 'depends_on'
  | 'contains'
  | 'powered_by'
  | 'network_uplink'

export interface AssetRelationship {
  id: string
  org_id: string
  parent_asset_id: string
  child_asset_id: string
  relationship_type: AssetRelationshipType
  created_by: string | null
  created_at: string
}

export interface CiImpactNode {
  asset_id: string
  serial_number: string | null
  status: string
  relationship_type: AssetRelationshipType
  depth: number
}

export interface CiImpactResponse {
  root_asset_id: string | null
  downstream: CiImpactNode[]
  open_ticket_count: number
}

// ============================================================================
// PSA — Problem Management + KEDB (Phase 6D)
// ============================================================================

export type PsaProblemStatus =
  | 'NEW'
  | 'UNDER_INVESTIGATION'
  | 'ROOT_CAUSE_IDENTIFIED'
  | 'WORKAROUND_AVAILABLE'
  | 'RESOLVED'
  | 'CLOSED'

export type PsaProblemType = 'REACTIVE' | 'PROACTIVE'

export type PsaRcaMethod = 'FIVE_WHYS' | 'FISHBONE' | 'FREE_TEXT'

export const PSA_PROBLEM_STATUS_TRANSITIONS: Record<PsaProblemStatus, PsaProblemStatus[]> = {
  NEW:                    ['UNDER_INVESTIGATION', 'CLOSED'],
  UNDER_INVESTIGATION:    ['ROOT_CAUSE_IDENTIFIED', 'WORKAROUND_AVAILABLE', 'CLOSED'],
  ROOT_CAUSE_IDENTIFIED:  ['WORKAROUND_AVAILABLE', 'RESOLVED', 'CLOSED'],
  WORKAROUND_AVAILABLE:   ['ROOT_CAUSE_IDENTIFIED', 'RESOLVED', 'CLOSED'],
  RESOLVED:               ['CLOSED'],
  CLOSED:                 [],
}

export interface PsaFiveWhysEntry {
  q: string
  a: string
}

export interface PsaFishboneData {
  people: string[]
  process: string[]
  equipment: string[]
  environment: string[]
  materials: string[]
  measurement: string[]
}

export interface PsaProblem {
  id: string
  org_id: string
  problem_number: string
  title: string
  description: string | null
  problem_type: PsaProblemType
  status: PsaProblemStatus
  priority: PsaPriority | null
  customer_id: string | null
  category: string | null
  rca_method: PsaRcaMethod | null
  rca_five_whys: PsaFiveWhysEntry[] | null
  rca_fishbone: PsaFishboneData | null
  rca_free_text: string | null
  root_cause: string | null
  workaround: string | null
  permanent_fix: string | null
  opened_at: string
  resolved_at: string | null
  closed_at: string | null
  assigned_to: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PsaProblemTicket {
  id: string
  problem_id: string
  ticket_id: string
  org_id: string
  linked_by: string | null
  linked_at: string
}

export interface PsaProblemStatusLog {
  id: string
  problem_id: string
  org_id: string
  from_status: PsaProblemStatus | null
  to_status: PsaProblemStatus
  changed_by: string | null
  reason: string | null
  created_at: string
}

export type PsaKedbAudience = 'internal' | 'customer_portal' | 'both'

export interface PsaKedbEntry {
  id: string
  org_id: string
  kedb_number: string
  title: string
  symptoms: string
  root_cause: string | null
  workaround: string | null
  permanent_fix: string | null
  category: string | null
  tags: string[] | null
  problem_id: string | null
  audience: PsaKedbAudience
  match_count: number
  last_matched_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  expires_at: string
  archived_at: string | null
}

export interface PsaProblemSuggestion {
  id: string
  org_id: string
  customer_id: string | null
  category: string
  incident_count: number
  window_days: number
  sample_ticket_ids: string[]
  status: 'pending' | 'accepted' | 'dismissed'
  problem_id: string | null
  created_at: string
  resolved_at: string | null
}

// ============================================================================
// PSA Invoicing + RMR Billing (Phase 7B + 7C)
// ============================================================================

export type InvoiceStatus =
  | 'DRAFT'
  | 'SENT'
  | 'VIEWED'
  | 'PARTIAL_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'VOID'
  | 'WRITTEN_OFF'

export const INVOICE_STATUSES: InvoiceStatus[] = [
  'DRAFT', 'SENT', 'VIEWED', 'PARTIAL_PAID', 'PAID', 'OVERDUE', 'VOID', 'WRITTEN_OFF',
]

export const INVOICE_STATUS_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  DRAFT:        ['SENT', 'VOID'],
  SENT:         ['VIEWED', 'PARTIAL_PAID', 'PAID', 'OVERDUE', 'VOID', 'WRITTEN_OFF'],
  VIEWED:       ['PARTIAL_PAID', 'PAID', 'OVERDUE', 'VOID', 'WRITTEN_OFF'],
  PARTIAL_PAID: ['PAID', 'OVERDUE', 'WRITTEN_OFF'],
  OVERDUE:      ['PARTIAL_PAID', 'PAID', 'VOID', 'WRITTEN_OFF'],
  PAID:         [],
  VOID:         [],
  WRITTEN_OFF:  [],
}

export type InvoiceSource = 'TICKET' | 'PROJECT' | 'CONTRACT_RMR' | 'MANUAL'

export type PaymentMethod =
  | 'CHECK'
  | 'ACH'
  | 'WIRE'
  | 'CASH'
  | 'CREDIT_CARD_OFFLINE'
  | 'OTHER'

export const PAYMENT_METHODS: PaymentMethod[] = [
  'CHECK', 'ACH', 'WIRE', 'CASH', 'CREDIT_CARD_OFFLINE', 'OTHER',
]

export type InvoiceLineSource = 'LABOR' | 'PARTS' | 'RMR' | 'FEE' | 'OTHER'

export type ContractStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'PAUSED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'RENEWED'

export const CONTRACT_STATUSES: ContractStatus[] = [
  'DRAFT', 'ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED', 'RENEWED',
]

export type ContractBillingModel =
  | 'PER_DEVICE'
  | 'PER_DOOR'
  | 'PER_CAMERA'
  | 'PCT_SYSTEM_VALUE'
  | 'PER_ROOM'
  | 'PER_USER'
  | 'PER_ENDPOINT'
  | 'FLAT_SITE'
  | 'BLOCK_TIME'
  | 'TIERED'
  | 'MILESTONE'

export const CONTRACT_BILLING_MODELS: ContractBillingModel[] = [
  'PER_DEVICE', 'PER_DOOR', 'PER_CAMERA', 'PCT_SYSTEM_VALUE',
  'PER_ROOM', 'PER_USER', 'PER_ENDPOINT', 'FLAT_SITE',
  'BLOCK_TIME', 'TIERED', 'MILESTONE',
]

export type ContractBillingCycle = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL'

export const CONTRACT_BILLING_CYCLES: ContractBillingCycle[] = [
  'MONTHLY', 'QUARTERLY', 'ANNUAL',
]

export type BlockTimeRollover = 'NONE' | 'FULL' | 'CAPPED'

export type ContractEventType =
  | 'CREATED'
  | 'ACTIVATED'
  | 'BILLED'
  | 'RENEWED'
  | 'CANCELLED'
  | 'PAUSED'
  | 'ESCALATED'
  | 'BLOCK_DEBIT'

export interface Invoice {
  id: string
  org_id: string
  invoice_number: string
  customer_id: string
  source: InvoiceSource
  source_ticket_id: string | null
  source_project_id: string | null
  source_contract_id: string | null
  status: InvoiceStatus
  issued_at: string
  due_date: string
  sent_at: string | null
  viewed_at: string | null
  paid_at: string | null
  payment_terms_days: number
  subtotal: number
  tax_rate: number
  tax_amount: number
  late_fee_amount: number
  total: number
  amount_paid: number
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface InvoiceLineItem {
  id: string
  invoice_id: string
  org_id: string
  description: string
  quantity: number
  unit_price: number
  line_total: number
  source_type: InvoiceLineSource
  source_ref_id: string | null
  created_at: string
}

export interface InvoicePayment {
  id: string
  invoice_id: string
  org_id: string
  amount: number
  method: PaymentMethod
  reference_number: string | null
  paid_at: string
  recorded_by: string | null
  notes: string | null
  created_at: string
}

export interface InvoiceReminder {
  id: string
  invoice_id: string
  org_id: string
  touchpoint: number
  sent_at: string
  delivery_status: string | null
  created_at: string
}

export interface ServiceContract {
  id: string
  org_id: string
  contract_number: string
  customer_id: string
  name: string
  status: ContractStatus
  billing_model: ContractBillingModel
  billing_cycle: ContractBillingCycle
  start_date: string
  end_date: string | null
  auto_renew: boolean
  renewal_notice_days: number
  annual_escalation_pct: number
  next_bill_date: string | null
  last_billed_at: string | null
  block_hours_total: number | null
  block_hours_used: number
  block_rollover_type: BlockTimeRollover
  block_rollover_cap: number | null
  overage_rate: number | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ContractLineItem {
  id: string
  contract_id: string
  org_id: string
  description: string
  asset_id: string | null
  quantity: number
  unit_rate: number
  monthly_amount: number
  created_at: string
}

export interface ContractEvent {
  id: string
  contract_id: string
  org_id: string
  event_type: ContractEventType
  details: Record<string, unknown> | null
  created_by: string | null
  created_at: string
}

// ============================================================
// Slice 2 — Customer Account Portal + Sub Compliance + Contract Builder
// ============================================================

export type CustomerPortalScope = 'OPP_ACCEPT' | 'CUSTOMER_ACCOUNT'
export type CustomerPortalRequestType = 'TICKET' | 'QUOTE' | 'GENERAL'
export type CustomerPortalRequestStatus = 'NEW' | 'TRIAGED' | 'CONVERTED' | 'CLOSED'

export interface CustomerPortalRequest {
  id: string
  org_id: string
  customer_id: string
  token_id: string | null
  type: CustomerPortalRequestType
  subject: string
  body: string | null
  priority: string | null
  status: CustomerPortalRequestStatus
  converted_to_ticket_id: string | null
  created_by_name: string | null
  created_by_email: string | null
  created_at: string
  updated_at: string
}

export interface CustomerSignature {
  id: string
  org_id: string
  customer_id: string
  entity_type: string
  entity_id: string
  signature_url: string
  signed_by_name: string
  signed_by_email: string | null
  signed_at: string
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export type ContractTemplateType =
  | 'MSA' | 'SLA_ADDENDUM' | 'SOW' | 'MONITORING' | 'PM'
  | 'MSSP' | 'AVAAS' | 'SUB_MASTER' | 'WORK_ORDER' | 'NDA'

export const CONTRACT_TEMPLATE_TYPES: ContractTemplateType[] = [
  'MSA', 'SLA_ADDENDUM', 'SOW', 'MONITORING', 'PM',
  'MSSP', 'AVAAS', 'SUB_MASTER', 'WORK_ORDER', 'NDA',
]

export const CONTRACT_TEMPLATE_TYPE_LABELS: Record<ContractTemplateType, string> = {
  MSA: 'Master Service Agreement',
  SLA_ADDENDUM: 'SLA Addendum',
  SOW: 'Statement of Work',
  MONITORING: 'Monitoring Agreement',
  PM: 'Preventive Maintenance',
  MSSP: 'MSSP Agreement',
  AVAAS: 'AV-as-a-Service',
  SUB_MASTER: 'Subcontractor Master',
  WORK_ORDER: 'Work Order',
  NDA: 'Non-Disclosure',
}

export type ContractTemplateStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED'

export type GeneratedContractStatus =
  | 'DRAFT' | 'PENDING_REVIEW' | 'SENT' | 'PARTIAL_SIGN'
  | 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'AMENDED'

export const GENERATED_CONTRACT_STATUSES: GeneratedContractStatus[] = [
  'DRAFT', 'PENDING_REVIEW', 'SENT', 'PARTIAL_SIGN',
  'ACTIVE', 'EXPIRED', 'CANCELLED', 'AMENDED',
]

export interface ContractClause {
  id: string
  org_id: string
  name: string
  category: string | null
  body_md: string
  version: number
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ContractTemplate {
  id: string
  org_id: string
  type: ContractTemplateType
  name: string
  version: number
  status: ContractTemplateStatus
  body_md: string
  variables: Array<{ key: string; label: string; default?: string }>
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ContractTemplateClause {
  id: string
  template_id: string
  clause_id: string
  display_order: number
  created_at: string
}

export interface GeneratedContract {
  id: string
  org_id: string
  contract_number: string
  template_id: string | null
  template_type: ContractTemplateType
  customer_id: string
  opp_id: string | null
  project_id: string | null
  service_contract_id: string | null
  title: string
  content: string
  status: GeneratedContractStatus
  variables: Record<string, string>
  sign_token: string | null
  sent_at: string | null
  signed_at: string | null
  signed_by_name: string | null
  signed_by_email: string | null
  signature_url: string | null
  expires_at: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}
