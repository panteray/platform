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
  FOV_DORI = 'fov_dori', SYSTEM_STORAGE = 'system_storage',
  WIRING_SCHEMATIC = 'wiring_schematic', MOUNTING = 'mounting',
  WIRELESS_PTP = 'wireless_ptp', CABLE_ESTIMATOR = 'cable_estimator',
  COVERAGE_AREA = 'coverage_area', PLAN_REVIEW = 'plan_review',
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
  ORDER_ENTRY = 'ORDER_ENTRY',
  SHIP_HOLD = 'SHIP_HOLD',
  PM_ASSIGNMENT = 'PM_ASSIGNMENT',
  PROJECT = 'PROJECT',
  IKOM = 'IKOM',
  CKOM = 'CKOM',
  SCHEDULING = 'SCHEDULING',
  AWAITING_DELIVERY = 'AWAITING_DELIVERY',
  INSTALL = 'INSTALL',
  QC = 'QC',
  SIGN_OFF = 'SIGN_OFF',
  CUSTOMER_SIGNATURE = 'CUSTOMER_SIGNATURE',
  OPERATIONAL_VALIDATION = 'OPERATIONAL_VALIDATION',
  COMPLETE = 'COMPLETE',
  OPERATIONAL_CLOSURE = 'OPERATIONAL_CLOSURE',
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

export enum BookingState {
  SOFT_BOOK = 'soft_book',
  HARD_BOOK = 'hard_book',
  CANCELLED = 'cancelled',
}

export const BOOKING_STATE_LABELS: Record<BookingState, string> = {
  [BookingState.SOFT_BOOK]: 'Soft Book',
  [BookingState.HARD_BOOK]: 'Hard Book',
  [BookingState.CANCELLED]: 'Cancelled',
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
  OppStatus.AWAITING_SIGNED_DOCS, OppStatus.ORDER_ENTRY, OppStatus.SHIP_HOLD,
  OppStatus.PM_ASSIGNMENT, OppStatus.PROJECT, OppStatus.IKOM, OppStatus.CKOM,
  OppStatus.SCHEDULING, OppStatus.AWAITING_DELIVERY, OppStatus.INSTALL,
  OppStatus.QC, OppStatus.SIGN_OFF, OppStatus.CUSTOMER_SIGNATURE,
  OppStatus.OPERATIONAL_VALIDATION, OppStatus.COMPLETE, OppStatus.OPERATIONAL_CLOSURE,
  OppStatus.CLOSED, OppStatus.ON_HOLD,
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
  [OppStatus.AWAITING_PO]: [OppStatus.AWAITING_SIGNED_DOCS, OppStatus.ORDER_ENTRY, OppStatus.ON_HOLD, OppStatus.CLOSED],
  [OppStatus.AWAITING_SIGNED_DOCS]: [OppStatus.AWAITING_PO, OppStatus.ORDER_ENTRY, OppStatus.ON_HOLD, OppStatus.CLOSED],
  [OppStatus.ORDER_ENTRY]: [OppStatus.SHIP_HOLD, OppStatus.PM_ASSIGNMENT, OppStatus.ON_HOLD, OppStatus.CLOSED],
  [OppStatus.SHIP_HOLD]: [OppStatus.PM_ASSIGNMENT, OppStatus.ON_HOLD, OppStatus.CLOSED],
  [OppStatus.PM_ASSIGNMENT]: [OppStatus.PROJECT, OppStatus.IKOM, OppStatus.ON_HOLD, OppStatus.CLOSED],
  [OppStatus.PROJECT]: [OppStatus.IKOM, OppStatus.AWAITING_DELIVERY, OppStatus.INSTALL, OppStatus.ON_HOLD, OppStatus.CLOSED],
  [OppStatus.IKOM]: [OppStatus.CKOM, OppStatus.ON_HOLD, OppStatus.CLOSED],
  [OppStatus.CKOM]: [OppStatus.SCHEDULING, OppStatus.ON_HOLD, OppStatus.CLOSED],
  [OppStatus.SCHEDULING]: [OppStatus.AWAITING_DELIVERY, OppStatus.ON_HOLD, OppStatus.CLOSED],
  [OppStatus.AWAITING_DELIVERY]: [OppStatus.INSTALL, OppStatus.ON_HOLD, OppStatus.CLOSED],
  [OppStatus.INSTALL]: [OppStatus.QC, OppStatus.ON_HOLD, OppStatus.CLOSED],
  [OppStatus.QC]: [OppStatus.SIGN_OFF, OppStatus.INSTALL, OppStatus.ON_HOLD, OppStatus.CLOSED],
  [OppStatus.SIGN_OFF]: [OppStatus.CUSTOMER_SIGNATURE, OppStatus.ON_HOLD, OppStatus.CLOSED],
  [OppStatus.CUSTOMER_SIGNATURE]: [OppStatus.OPERATIONAL_VALIDATION, OppStatus.ON_HOLD, OppStatus.CLOSED],
  [OppStatus.OPERATIONAL_VALIDATION]: [OppStatus.COMPLETE, OppStatus.ON_HOLD, OppStatus.CLOSED],
  [OppStatus.COMPLETE]: [OppStatus.OPERATIONAL_CLOSURE],
  [OppStatus.OPERATIONAL_CLOSURE]: [OppStatus.CLOSED],
  [OppStatus.CLOSED]: [],
  [OppStatus.ON_HOLD]: [
    OppStatus.NEW, OppStatus.ASSIGNED_TO_PRESALES, OppStatus.SURVEY,
    OppStatus.DESIGN, OppStatus.SUBMITTED_FOR_QUOTE, OppStatus.AWAITING_SOW,
    OppStatus.SUBMITTED_TO_CUSTOMER, OppStatus.AWAITING_PO, OppStatus.AWAITING_SIGNED_DOCS,
    OppStatus.ORDER_ENTRY, OppStatus.SHIP_HOLD, OppStatus.PM_ASSIGNMENT,
    OppStatus.PROJECT, OppStatus.IKOM, OppStatus.CKOM, OppStatus.SCHEDULING,
    OppStatus.INSTALL, OppStatus.OPERATIONAL_VALIDATION, OppStatus.OPERATIONAL_CLOSURE,
    OppStatus.CLOSED,
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
  [OppStatus.ORDER_ENTRY]: 'Order Entry',
  [OppStatus.SHIP_HOLD]: 'Ship Hold',
  [OppStatus.PM_ASSIGNMENT]: 'PM Assignment',
  [OppStatus.PROJECT]: 'Project',
  [OppStatus.IKOM]: 'Internal Kickoff',
  [OppStatus.CKOM]: 'Customer Kickoff',
  [OppStatus.SCHEDULING]: 'Scheduling',
  [OppStatus.AWAITING_DELIVERY]: 'Awaiting Delivery',
  [OppStatus.INSTALL]: 'Install',
  [OppStatus.QC]: 'QC',
  [OppStatus.SIGN_OFF]: 'Sign Off',
  [OppStatus.CUSTOMER_SIGNATURE]: 'Customer Signature',
  [OppStatus.OPERATIONAL_VALIDATION]: 'Operational Validation',
  [OppStatus.COMPLETE]: 'Complete',
  [OppStatus.OPERATIONAL_CLOSURE]: 'Operational Closure',
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

// ---- Huddle Role Constants ----
export const HUDDLE_VISIBLE_ROLES = ['GLOBAL_ADMIN', 'GLOBAL_MANAGER', 'ORG_ADMIN', 'ORG_MANAGER', 'MANAGER', 'OPERATIONS', 'SALES_ISR', 'SALES_OSR', 'PRESALES', 'PROJECT_MANAGER'] as const
export const HUDDLE_ADMIN_ROLES = ['GLOBAL_ADMIN', 'ORG_ADMIN', 'ORG_MANAGER'] as const

// ---- Device Library (Phase 6) ----

export enum DeviceCategory {
  CCTV = 'cctv',
  ACCESS_CONTROL = 'access_control',
  SERVERS_NVR = 'servers_nvr',
  NETWORK = 'network',
  AV = 'av',
  VAPE_ENVIRONMENTAL = 'vape_environmental',
  OTHER = 'other',
}

export type NdaaStatus = 'compliant' | 'non_compliant' | 'mixed' | 'unverified'

export type ContributionStatus = 'pending_review' | 'approved' | 'rejected' | 'merged'

export type ImportBatchStatus = 'uploaded' | 'processing' | 'parsed' | 'committed' | 'failed'

export type ImportRowStatus = 'pending' | 'approved' | 'rejected' | 'committed'

export type ImportFileType = 'pdf' | 'xlsx' | 'csv'

export const DEVICE_CATEGORIES = [
  { value: 'cctv', label: 'CCTV' },
  { value: 'access_control', label: 'Access Control' },
  { value: 'servers_nvr', label: 'Servers / NVR' },
  { value: 'network', label: 'Network' },
  { value: 'av', label: 'AV' },
  { value: 'vape_environmental', label: 'Vape / Environmental' },
  { value: 'other', label: 'Other' },
] as const

export const NDAA_STATUS_OPTIONS = [
  { value: 'compliant', label: 'Compliant' },
  { value: 'non_compliant', label: 'Non-Compliant' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'unverified', label: 'Unverified' },
] as const

/** Roles with access to Device Library (browse, import, contribute) */
export const DEVICE_LIBRARY_ROLES = [
  'GLOBAL_ADMIN', 'GLOBAL_MANAGER', 'ORG_ADMIN', 'ORG_MANAGER', 'MANAGER',
  'OPERATIONS', 'SALES_ISR', 'SALES_OSR', 'PRESALES', 'PROJECT_MANAGER', 'TECH_SUP', 'LEAD', 'FIELD_TECH',
] as const

/** Accepted file extensions for device import */
export const IMPORT_ACCEPTED_EXTENSIONS = ['.pdf', '.xlsx', '.xls', '.csv'] as const
export const IMPORT_ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
] as const
export const IMPORT_MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB

// ---- Design Canvas (Phase 7) ----

export enum CanvasAreaType {
  FLOOR_PLAN = 'FLOOR_PLAN',
  SATELLITE = 'SATELLITE',
  GRID = 'GRID',
  BLANK = 'BLANK',
}

export enum DesignCanvasStatus {
  DRAFT = 'draft',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
}

export enum DeviceStatus {
  NEW = 'new',
  EXISTING_KEEP = 'existing_keep',
  EXISTING_REMOVE = 'existing_remove',
  RELOCATE = 'relocate',
}

export enum ConditionType {
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
  UNKNOWN = 'unknown',
}

export enum CableType {
  CAT5E = 'cat5e',
  CAT6 = 'cat6',
  FIBER_OM3 = 'fiber_om3',
  FIBER_OM4 = 'fiber_om4',
  FIBER_SM = 'fiber_sm',
  WIRE_18_2 = '18_2',
  WIRE_22_4 = '22_4',
  WIRE_22_6 = '22_6',
  WIRE_14_2 = '14_2',
  SPEAKER_WIRE = 'speaker_wire',
  OTHER = 'other',
}

export enum TopologyNodeType {
  FIREWALL = 'FIREWALL',
  CORE_SWITCH = 'CORE_SWITCH',
  DIST_SWITCH = 'DIST_SWITCH',
  ACCESS_SWITCH = 'ACCESS_SWITCH',
  ROUTER = 'ROUTER',
  WIRELESS_CONTROLLER = 'WIRELESS_CONTROLLER',
  AP = 'AP',
  SERVER = 'SERVER',
  NVR_VMS = 'NVR_VMS',
  CLOUD_ISP = 'CLOUD_ISP',
  CLIENT = 'CLIENT',
}

export enum TopologyLayer {
  L1 = 'L1',
  L2 = 'L2',
  L3 = 'L3',
}

export enum TopologySpeed {
  G1 = '1G',
  G10 = '10G',
  G25 = '25G',
  G40 = '40G',
  G100 = '100G',
  FIBER = 'FIBER',
}

export enum AvoipProtocol {
  DANTE = 'DANTE',
  AES67 = 'AES67',
  NDI = 'NDI',
  CONTROL = 'CONTROL',
}

export enum AvoipNicType {
  PRIMARY = 'PRIMARY',
  SECONDARY = 'SECONDARY',
}

export const CANVAS_AREA_TYPES = [
  { value: 'FLOOR_PLAN', label: 'Floor Plan' },
  { value: 'SATELLITE', label: 'Satellite' },
  { value: 'GRID', label: 'Grid' },
  { value: 'BLANK', label: 'Blank' },
] as const

export const DEVICE_STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'existing_keep', label: 'Existing Keep' },
  { value: 'existing_remove', label: 'Existing Remove' },
  { value: 'relocate', label: 'Relocate' },
] as const

export const CONDITION_OPTIONS = [
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
  { value: 'unknown', label: 'Unknown' },
] as const

export const CABLE_TYPE_OPTIONS = [
  { value: 'cat5e', label: 'Cat5e' },
  { value: 'cat6', label: 'Cat6' },
  { value: 'fiber_om3', label: 'Fiber OM3' },
  { value: 'fiber_om4', label: 'Fiber OM4' },
  { value: 'fiber_sm', label: 'Fiber SM' },
  { value: '18_2', label: '18/2' },
  { value: '22_4', label: '22/4' },
  { value: '22_6', label: '22/6' },
  { value: '14_2', label: '14/2' },
  { value: 'speaker_wire', label: 'Speaker Wire' },
  { value: 'other', label: 'Other' },
] as const

export const MOUNT_TYPES = ['ceiling', 'wall', 'pole', 'pendant'] as const

export const TOPOLOGY_NODE_TYPE_OPTIONS = [
  { value: 'FIREWALL', label: 'Firewall' },
  { value: 'CORE_SWITCH', label: 'Core Switch' },
  { value: 'DIST_SWITCH', label: 'Distribution Switch' },
  { value: 'ACCESS_SWITCH', label: 'Access Switch' },
  { value: 'ROUTER', label: 'Router' },
  { value: 'WIRELESS_CONTROLLER', label: 'Wireless Controller' },
  { value: 'AP', label: 'Access Point' },
  { value: 'SERVER', label: 'Server' },
  { value: 'NVR_VMS', label: 'NVR / VMS' },
  { value: 'CLOUD_ISP', label: 'Cloud / ISP' },
  { value: 'CLIENT', label: 'Client' },
] as const

export const TOPOLOGY_SPEED_OPTIONS = [
  { value: '1G', label: '1G' },
  { value: '10G', label: '10G' },
  { value: '25G', label: '25G' },
  { value: '40G', label: '40G' },
  { value: '100G', label: '100G' },
  { value: 'FIBER', label: 'Fiber' },
] as const

/** Roles with access to design canvas */
export const DESIGN_ACCESS_ROLES = [
  'GLOBAL_ADMIN', 'GLOBAL_MANAGER', 'ORG_ADMIN', 'ORG_MANAGER',
  'PRESALES', 'PROJECT_MANAGER', 'TECH_SUP', 'LEAD', 'MANAGER', 'OPERATIONS',
] as const

/** 16-color palette for design canvas (from CASDEX) */
export const CANVAS_COLORS_16 = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#6366f1', '#a855f7', '#f43f5e',
  '#fb923c', '#84cc16', '#10b981', '#0ea5e9',
] as const
