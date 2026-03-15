// ============================================================
// PANTERAY — Enum Types (mirrors Supabase enums exactly)
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
  SEC = 'SEC',
  AV = 'AV',
  NET = 'NET',
  CYB = 'CYB',
  MSP = 'MSP',
  SVC = 'SVC',
  SALES = 'SALES',
  OPS = 'OPS',
}

export enum UserType {
  SEC = 'SEC',
  AV = 'AV',
  NET = 'NET',
  CYB = 'CYB',
  MSP = 'MSP',
  MSFT = 'MSFT',
  SVC = 'SVC',
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
  FOV_DORI = 'fov_dori',
  LPR = 'lpr',
  SYSTEM_STORAGE = 'system_storage',
  SOLAR = 'solar',
  WIRING_SCHEMATIC = 'wiring_schematic',
  MOUNTING = 'mounting',
  WIRELESS_PTP = 'wireless_ptp',
  CABLE_ESTIMATOR = 'cable_estimator',
  PLAN_REVIEW = 'plan_review',
}

// ---- Derived sets ----

export const GLOBAL_ROLES = [UserRole.GLOBAL_ADMIN, UserRole.GLOBAL_MANAGER] as const

export const PLATFORM_MODULES: ModuleName[] = [
  ModuleName.OPPORTUNITIES,
  ModuleName.SURVEY,
  ModuleName.DESIGN,
  ModuleName.DOCUMENTS,
  ModuleName.PROJECT_MANAGEMENT,
  ModuleName.CALCULATORS,
  ModuleName.CUSTOMER,
  ModuleName.SUBCONTRACTOR,
  ModuleName.FIELD_INSTALL,
]

export const PSA_SUB_MODULES: ModuleName[] = [
  ModuleName.SERVICE_DESK,
  ModuleName.DISPATCH,
  ModuleName.COMPLIANCE_ENGINE,
  ModuleName.JOB_COSTING,
  ModuleName.PROBLEM_MANAGEMENT,
  ModuleName.CHANGE_ORDERS,
  ModuleName.MOBILE_TECH,
  ModuleName.INVOICING,
  ModuleName.RMR_BILLING,
  ModuleName.SUB_PORTAL,
  ModuleName.CUSTOMER_PORTAL,
  ModuleName.CONTRACT_BUILDER,
  ModuleName.INTEGRATIONS,
  ModuleName.REPORTING,
]

/** PSA dependency map: module -> required parent module (null = depends only on PSA master) */
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
  ...PLATFORM_MODULES,
  ModuleName.PSA,
  ...PSA_SUB_MODULES,
]
