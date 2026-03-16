// ============================================================
// PANTERAY — Enum Types (mirrors Supabase enums exactly)
// Phase 5: OPP + CRM + Huddle enums + CRM Lead enums (deferred build)
// ============================================================

export enum UserRole {
  GLOBAL_ADMIN = 'GLOBAL_ADMIN',
  GLOBAL_MANAGER = 'GLOBAL_MANAGER',
  ORG_ADMIN = 'ORG_ADMIN',
  ORG_MANAGER = 'ORG_MANAGER',
  MANAGER = 'MANAGER',
  OPERATIONS = 'OPERATIONS',
  SALES_ISR = 'SALES_ISR',
  SALES_OSR = 'SALES_OSR',
  PRESALES = 'PRESALES',
  PROJECT_MANAGER = 'PROJECT_MANAGER',
  TECH_SUP = 'TECH_SUP',
  LEAD = 'LEAD',
  FIELD_TECH = 'FIELD_TECH',
  SUBCONTRACTOR = 'SUBCONTRACTOR',
  CUSTOMER = 'CUSTOMER',
}

export enum UserDivision {
  SEC = 'SEC', AV = 'AV', NET = 'NET', CYB = 'CYB',
  MSP = 'MSP', SVC = 'SVC', SALES = 'SALES', OPS = 'OPS',
}

export enum UserType {
  SEC = 'SEC', AV = 'AV', NET = 'NET', CYB = 'CYB',
  MSP = 'MSP', MSFT = 'MSFT', SVC = 'SVC',
}

export enum ModuleName {
  // Platform modules (Phase 1-10)
  OPPORTUNITIES = 'opportunities',
  SURVEY = 'survey',
  DESIGN = 'design',
  DOCUMENTS = 'documents',
  PROJECT_MANAGEMENT = 'project_management',
  CALCULATORS = 'calculators',
  CUSTOMER = 'customer',
  SUBCONTRACTOR = 'subcontractor',
  FIELD_INSTALL = 'field_install',
  // CRM Lead Module (Phase 5 types, deferred build)
  LEADS_CRM = 'leads_crm',
  // PSA parent toggle
  PSA = 'psa',
  // PSA sub-modules (Phase 11-20)
  SERVICE_DESK = 'service_desk',
  DISPATCH = 'dispatch',
  COMPLIANCE_ENGINE = 'compliance_engine',
  JOB_COSTING = 'job_costing',
  PROBLEM_MANAGEMENT = 'problem_management',
  CHANGE_ORDERS = 'change_orders',
  MOBILE_TECH = 'mobile_tech',
  INVOICING = 'invoicing',
  RMR_BILLING = 'rmr_billing',
  SUB_PORTAL = 'sub_portal',
  CUSTOMER_PORTAL = 'customer_portal',
  CONTRACT_BUILDER = 'contract_builder',
  INTEGRATIONS = 'integrations',
  REPORTING = 'reporting',
}

export enum CalculatorType {
  FOV_DORI = 'fov_dori', LPR = 'lpr', SYSTEM_STORAGE = 'system_storage',
  SOLAR = 'solar', WIRING_SCHEMATIC = 'wiring_schematic', MOUNTING = 'mounting',
  WIRELESS_PTP = 'wireless_ptp', CABLE_ESTIMATOR = 'cable_estimator', PLAN_REVIEW = 'plan_review',
}

// ---- Phase 5 Enums ----

export enum OppStatus {
  NEW = 'NEW',
  ASSIGNED_TO_PRESALES = 'ASSIGNED_TO_PRESALES',
  SURVEY = 'SURVEY',
  DESIGN = 'DESIGN',
  WAITING_ON_INFO = 'WAITING_ON_INFO',
  SUBMITTED_FOR_QUOTE = 'SUBMITTED_FOR_QUOTE',
  AWAITING_SOW = 'AWAITING_SOW',
  SUBMITTED_TO_CUSTOMER = 'SUBMITTED_TO_CUSTOMER',
  AWAITING_PO = 'AWAITING_PO',
  AWAITING_SIGNED_DOCS = 'AWAITING_SIGNED_DOCS',
  PROJECT = 'PROJECT',
  AWAITING_DELIVERY = 'AWAITING_DELIVERY',
  INSTALL = 'INSTALL',
  QC = 'QC',
  SIGN_OFF = 'SIGN_OFF',
  CUSTOMER_SIGNATURE = 'CUSTOMER_SIGNATURE',
  COMPLETE = 'COMPLETE',
  CLOSED = 'CLOSED',
  ON_HOLD = 'ON_HOLD',
}

export enum OppType {
  SEC = 'SEC', AV = 'AV', NET = 'NET', CYB = 'CYB', MSP = 'MSP', SVC = 'SVC',
}

export enum CustomerType {
  K12 = 'K12', HED = 'HED', GOV = 'GOV', BIZ = 'BIZ', MED = 'MED',
}

export enum CustomerTier {
  Platinum = 'Platinum', Gold = 'Gold', Silver = 'Silver', Bronze = 'Bronze', Review = 'Review',
}

export enum ManufacturerType {
  CCTV = 'CCTV', ACCESS_CONTROL = 'ACCESS_CONTROL', VMS = 'VMS',
  NETWORKING = 'NETWORKING', AV = 'AV', GENERAL = 'GENERAL',
  SOFTWARE = 'SOFTWARE', CYBERSECURITY = 'CYBERSECURITY',
}

export enum SubWorkType {
  SEC = 'SEC', NET = 'NET', AV = 'AV', CYB = 'CYB', SVC = 'SVC', MSP = 'MSP',
}

// ---- CRM Lead Module Enums (from Dexter's code — authoritative) ----

export enum LeadStatus {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  QUALIFYING = 'QUALIFYING',
  QUALIFIED = 'QUALIFIED',
  CONVERTED = 'CONVERTED',
  ARCHIVED = 'ARCHIVED',
}

export enum LeadSource {
  BUSINESS_CARD_SCAN = 'BUSINESS_CARD_SCAN',
  TRADE_SHOW = 'TRADE_SHOW',
  REFERRAL = 'REFERRAL',
  COLD_CALL = 'COLD_CALL',
  WEBSITE = 'WEBSITE',
  WALK_IN = 'WALK_IN',
  EMAIL = 'EMAIL',
  PARTNER = 'PARTNER',
  OTHER = 'OTHER',
}

export enum LeadPriority {
  HOT = 'HOT',
  WARM = 'WARM',
  COLD = 'COLD',
}

export enum LeadArchiveReason {
  NOT_QUALIFIED = 'NOT_QUALIFIED',
  WENT_COLD = 'WENT_COLD',
  DUPLICATE = 'DUPLICATE',
  NO_BUDGET = 'NO_BUDGET',
  NO_RESPONSE = 'NO_RESPONSE',
  COMPETITOR = 'COMPETITOR',
  OTHER = 'OTHER',
}

export enum InteractionType {
  CALL = 'CALL',
  EMAIL = 'EMAIL',
  MEETING = 'MEETING',
  SITE_VISIT = 'SITE_VISIT',
  NOTE = 'NOTE',
  TEXT = 'TEXT',
  LINKEDIN = 'LINKEDIN',
  OTHER = 'OTHER',
}

export enum InteractionDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
}

// ---- Huddle Enums ----

export enum PeerHuddleRole {
  ISR = 'ISR', OSR = 'OSR', PRESALES = 'PRESALES', PM = 'PM',
  INSTALLER = 'INSTALLER', SUBCONTRACTOR = 'SUBCONTRACTOR', TYPE = 'TYPE',
}

export enum PeerHuddleVertical {
  HED = 'HED', GOV = 'GOV', MED = 'MED', BIZ = 'BIZ', K12 = 'K12',
}

export enum PeerHuddleType {
  SEC = 'SEC', NET = 'NET', AV = 'AV', CYB = 'CYB',
  MSP = 'MSP', MSFT = 'MSFT', SVC = 'SVC',
}

// ---- Derived sets ----

export const GLOBAL_ROLES = [UserRole.GLOBAL_ADMIN, UserRole.GLOBAL_MANAGER] as const

export const PLATFORM_MODULES: ModuleName[] = [
  ModuleName.OPPORTUNITIES, ModuleName.SURVEY, ModuleName.DESIGN,
  ModuleName.DOCUMENTS, ModuleName.PROJECT_MANAGEMENT, ModuleName.CALCULATORS,
  ModuleName.CUSTOMER, ModuleName.SUBCONTRACTOR, ModuleName.FIELD_INSTALL,
  ModuleName.LEADS_CRM,
]

export const PSA_SUB_MODULES: ModuleName[] = [
  ModuleName.SERVICE_DESK, ModuleName.DISPATCH, ModuleName.COMPLIANCE_ENGINE,
  ModuleName.JOB_COSTING, ModuleName.PROBLEM_MANAGEMENT, ModuleName.CHANGE_ORDERS,
  ModuleName.MOBILE_TECH, ModuleName.INVOICING, ModuleName.RMR_BILLING,
  ModuleName.SUB_PORTAL, ModuleName.CUSTOMER_PORTAL, ModuleName.CONTRACT_BUILDER,
  ModuleName.INTEGRATIONS, ModuleName.REPORTING,
]

export const PSA_DEPENDENCIES: Record<string, ModuleName | null> = {
  [ModuleName.SERVICE_DESK]: null,
  [ModuleName.DISPATCH]: ModuleName.SERVICE_DESK,
  [ModuleName.COMPLIANCE_ENGINE]: ModuleName.SERVICE_DESK,
  [ModuleName.JOB_COSTING]: ModuleName.SERVICE_DESK,
  [ModuleName.PROBLEM_MANAGEMENT]: ModuleName.SERVICE_DESK,
  [ModuleName.CHANGE_ORDERS]: ModuleName.SERVICE_DESK,
  [ModuleName.MOBILE_TECH]: ModuleName.SERVICE_DESK,
  [ModuleName.INVOICING]: ModuleName.JOB_COSTING,
  [ModuleName.RMR_BILLING]: ModuleName.INVOICING,
  [ModuleName.SUB_PORTAL]: ModuleName.SERVICE_DESK,
  [ModuleName.CUSTOMER_PORTAL]: ModuleName.SERVICE_DESK,
  [ModuleName.CONTRACT_BUILDER]: ModuleName.SERVICE_DESK,
  [ModuleName.INTEGRATIONS]: ModuleName.SERVICE_DESK,
  [ModuleName.REPORTING]: null,
}

export const ALL_MODULES: ModuleName[] = [
  ...PLATFORM_MODULES, ModuleName.PSA, ...PSA_SUB_MODULES,
]

/** OPP status display order */
export const OPP_STATUS_ORDER: OppStatus[] = [
  OppStatus.NEW, OppStatus.ASSIGNED_TO_PRESALES, OppStatus.SURVEY,
  OppStatus.DESIGN, OppStatus.WAITING_ON_INFO, OppStatus.SUBMITTED_FOR_QUOTE,
  OppStatus.AWAITING_SOW, OppStatus.SUBMITTED_TO_CUSTOMER, OppStatus.AWAITING_PO,
  OppStatus.AWAITING_SIGNED_DOCS, OppStatus.PROJECT, OppStatus.AWAITING_DELIVERY,
  OppStatus.INSTALL, OppStatus.QC, OppStatus.SIGN_OFF, OppStatus.CUSTOMER_SIGNATURE,
  OppStatus.COMPLETE, OppStatus.CLOSED, OppStatus.ON_HOLD,
]

/** OPP status -> allowed next statuses (state machine) */
export const OPP_STATUS_TRANSITIONS: Record<OppStatus, OppStatus[]> = {
  [OppStatus.NEW]: [OppStatus.ASSIGNED_TO_PRESALES, OppStatus.ON_HOLD, OppStatus.CLOSED],
  [OppStatus.ASSIGNED_TO_PRESALES]: [OppStatus.SURVEY, OppStatus.DESIGN, OppStatus.ON_HOLD, OppStatus.CLOSED],
  [OppStatus.SURVEY]: [OppStatus.DESIGN, OppStatus.WAITING_ON_INFO, OppStatus.ON_HOLD, OppStatus.CLOSED],
  [OppStatus.DESIGN]: [OppStatus.SUBMITTED_FOR_QUOTE, OppStatus.WAITING_ON_INFO, OppStatus.ON_HOLD, OppStatus.CLOSED],
  [OppStatus.WAITING_ON_INFO]: [OppStatus.SURVEY, OppStatus.DESIGN, OppStatus.SUBMITTED_FOR_QUOTE, OppStatus.ON_HOLD, OppStatus.CLOSED],
  [OppStatus.SUBMITTED_FOR_QUOTE]: [OppStatus.AWAITING_SOW, OppStatus.WAITING_ON_INFO, OppStatus.ON_HOLD, OppStatus.CLOSED],
  [OppStatus.AWAITING_SOW]: [OppStatus.SUBMITTED_TO_CUSTOMER, OppStatus.WAITING_ON_INFO, OppStatus.ON_HOLD, OppStatus.CLOSED],
  [OppStatus.SUBMITTED_TO_CUSTOMER]: [OppStatus.AWAITING_PO, OppStatus.AWAITING_SIGNED_DOCS, OppStatus.WAITING_ON_INFO, OppStatus.ON_HOLD, OppStatus.CLOSED],
  [OppStatus.AWAITING_PO]: [OppStatus.AWAITING_SIGNED_DOCS, OppStatus.PROJECT, OppStatus.ON_HOLD, OppStatus.CLOSED],
  [OppStatus.AWAITING_SIGNED_DOCS]: [OppStatus.AWAITING_PO, OppStatus.PROJECT, OppStatus.ON_HOLD, OppStatus.CLOSED],
  [OppStatus.PROJECT]: [OppStatus.AWAITING_DELIVERY, OppStatus.INSTALL, OppStatus.ON_HOLD, OppStatus.CLOSED],
  [OppStatus.AWAITING_DELIVERY]: [OppStatus.INSTALL, OppStatus.ON_HOLD, OppStatus.CLOSED],
  [OppStatus.INSTALL]: [OppStatus.QC, OppStatus.ON_HOLD, OppStatus.CLOSED],
  [OppStatus.QC]: [OppStatus.SIGN_OFF, OppStatus.INSTALL, OppStatus.ON_HOLD, OppStatus.CLOSED],
  [OppStatus.SIGN_OFF]: [OppStatus.CUSTOMER_SIGNATURE, OppStatus.ON_HOLD, OppStatus.CLOSED],
  [OppStatus.CUSTOMER_SIGNATURE]: [OppStatus.COMPLETE, OppStatus.ON_HOLD, OppStatus.CLOSED],
  [OppStatus.COMPLETE]: [OppStatus.CLOSED],
  [OppStatus.CLOSED]: [],
  [OppStatus.ON_HOLD]: [
    OppStatus.NEW, OppStatus.ASSIGNED_TO_PRESALES, OppStatus.SURVEY,
    OppStatus.DESIGN, OppStatus.SUBMITTED_FOR_QUOTE, OppStatus.AWAITING_SOW,
    OppStatus.SUBMITTED_TO_CUSTOMER, OppStatus.AWAITING_PO, OppStatus.AWAITING_SIGNED_DOCS,
    OppStatus.PROJECT, OppStatus.INSTALL, OppStatus.CLOSED,
  ],
}

/** Human-readable OPP status labels */
export const OPP_STATUS_LABELS: Record<OppStatus, string> = {
  [OppStatus.NEW]: 'New',
  [OppStatus.ASSIGNED_TO_PRESALES]: 'Assigned to Presales',
  [OppStatus.SURVEY]: 'Survey',
  [OppStatus.DESIGN]: 'Design',
  [OppStatus.WAITING_ON_INFO]: 'Waiting on Info',
  [OppStatus.SUBMITTED_FOR_QUOTE]: 'Submitted for Quote',
  [OppStatus.AWAITING_SOW]: 'Awaiting SOW',
  [OppStatus.SUBMITTED_TO_CUSTOMER]: 'Submitted to Customer',
  [OppStatus.AWAITING_PO]: 'Awaiting PO',
  [OppStatus.AWAITING_SIGNED_DOCS]: 'Awaiting Signed Docs',
  [OppStatus.PROJECT]: 'Project',
  [OppStatus.AWAITING_DELIVERY]: 'Awaiting Delivery',
  [OppStatus.INSTALL]: 'Install',
  [OppStatus.QC]: 'QC',
  [OppStatus.SIGN_OFF]: 'Sign Off',
  [OppStatus.CUSTOMER_SIGNATURE]: 'Customer Signature',
  [OppStatus.COMPLETE]: 'Complete',
  [OppStatus.CLOSED]: 'Closed',
  [OppStatus.ON_HOLD]: 'On Hold',
}

/** Lead status -> allowed next statuses */
export const LEAD_STATUS_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  [LeadStatus.NEW]: [LeadStatus.CONTACTED, LeadStatus.ARCHIVED],
  [LeadStatus.CONTACTED]: [LeadStatus.QUALIFYING, LeadStatus.ARCHIVED],
  [LeadStatus.QUALIFYING]: [LeadStatus.QUALIFIED, LeadStatus.CONTACTED, LeadStatus.ARCHIVED],
  [LeadStatus.QUALIFIED]: [LeadStatus.CONVERTED, LeadStatus.QUALIFYING, LeadStatus.ARCHIVED],
  [LeadStatus.CONVERTED]: [],
  [LeadStatus.ARCHIVED]: [LeadStatus.NEW],
}

// ---- Shared Constants ----

export const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
] as const

export const ENTITY_TYPES = ['LLC', 'Corporation', 'S-Corp', 'Sole Proprietorship', 'Partnership', 'Non-Profit'] as const
export const ONBOARDING_STATUSES = ['Not Started', 'Documentation Pending', 'Internal Review', 'Active', 'At Risk'] as const
export const MANUFACTURER_STATUSES = ['Pending Docs', 'Not Started', 'Internal Review', 'Needs Approval', 'Active', 'At Risk', 'Stalled'] as const
export const SUB_STATUSES = ['Pending Docs', 'Internal Review', 'Active', 'At Risk', 'Stalled'] as const
export const SUB_TYPES = ['Labor', 'Full'] as const
export const PAYMENT_TERMS_OPTIONS = ['Net-15', 'Net-30', 'Net-60', 'Net-90', 'Due on Receipt'] as const
export const ACCEPTED_PAYMENT_METHODS_OPTIONS = ['ACH', 'Credit Card', 'Check', 'Stripe', 'PayPal'] as const
export const PARTNER_LEVELS = ['Platinum', 'Gold', 'Silver', 'Bronze', 'Authorized', 'Reseller'] as const

export const MANUFACTURER_CATEGORY_OPTIONS = [
  { value: 'CCTV', label: 'CCTV' },
  { value: 'ACCESS_CONTROL', label: 'Access Control' },
  { value: 'VMS', label: 'VMS' },
  { value: 'NETWORKING', label: 'Networking' },
  { value: 'AV', label: 'AV' },
  { value: 'GENERAL', label: 'General' },
  { value: 'SOFTWARE', label: 'Software' },
  { value: 'CYBERSECURITY', label: 'Cybersecurity' },
] as const

export const DISCIPLINE_TYPES = ['SEC', 'AV', 'NET', 'CYB', 'MSP', 'SVC'] as const

/** Tier badge colors */
export const TIER_COLORS: Record<string, { bg: string; fg: string }> = {
  Platinum: { bg: 'rgba(148,163,184,0.15)', fg: '#94a3b8' },
  Gold: { bg: 'rgba(234,179,8,0.15)', fg: '#eab308' },
  Silver: { bg: 'rgba(148,163,184,0.12)', fg: '#9ca3af' },
  Bronze: { bg: 'rgba(180,120,60,0.15)', fg: '#b4783c' },
  Review: { bg: 'rgba(161,161,170,0.12)', fg: '#a1a1aa' },
  Authorized: { bg: 'rgba(161,161,170,0.12)', fg: '#a1a1aa' },
  Reseller: { bg: 'rgba(161,161,170,0.12)', fg: '#a1a1aa' },
  Preferred: { bg: 'rgba(34,197,94,0.12)', fg: '#22c55e' },
}

// ---- Distributor Constants ----
export const DISTRIBUTOR_STATUSES = ['Active', 'Inactive'] as const
export const CARRIER_OPTIONS = ['FedEx', 'UPS', 'USPS', 'Freight', 'Courier', 'Direct Ship', 'Customer Pickup', 'Other'] as const
export const MATERIAL_SHIP_STATUSES = ['NOT_ORDERED', 'ORDERED', 'IN_TRANSIT', 'DELIVERED', 'PARTIAL', 'BACKORDERED'] as const
export const OPP_DISTRIBUTOR_STATUSES = ['QUOTING', 'QUOTED', 'APPROVED', 'ORDERED'] as const
export const REQUEST_TYPE_OPTIONS = ['New Install', 'Upgrade', 'Service', 'Add-On', 'Renewal', 'Consultation'] as const
export const LABOR_REQUIREMENT_OPTIONS = ['TBD', 'Standard', 'Complex', 'Government', 'Union'] as const
export const OPP_GRADE_OPTIONS = ['A', 'B', 'C', 'D', 'F'] as const
export const COMPLEXITY_OPTIONS = ['Low', 'Medium', 'High', 'Critical'] as const
