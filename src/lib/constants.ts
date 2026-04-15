// ============================================================
// PANTERAY — Constants & Labels
// ============================================================

import {
  ModuleName,
  CalculatorType,
  UserDivision,
  PLATFORM_MODULES,
  PSA_SUB_MODULES,
} from '@/types/enums'

// ---- Module Labels ----

export const MODULE_LABELS: Record<ModuleName, string> = {
  [ModuleName.OPPORTUNITIES]: 'Opportunities',
  [ModuleName.SURVEY]: 'Survey',
  [ModuleName.DESIGN]: 'Design',
  [ModuleName.DOCUMENTS]: 'Documents',
  [ModuleName.PROJECT_MANAGEMENT]: 'Project Management',
  [ModuleName.CALCULATORS]: 'Calculators',
  [ModuleName.CUSTOMER]: 'Customer',
  [ModuleName.SUBCONTRACTOR]: 'Subcontractor',
  [ModuleName.FIELD_INSTALL]: 'Field Install',
  [ModuleName.LEADS_CRM]: 'Leads / CRM',
  [ModuleName.PSA]: 'PSA — Service Engine',
  [ModuleName.SERVICE_DESK]: 'Service Desk',
  [ModuleName.DISPATCH]: 'Dispatch Board',
  [ModuleName.COMPLIANCE_ENGINE]: 'Compliance Engine',
  [ModuleName.JOB_COSTING]: 'Job Costing',
  [ModuleName.PROBLEM_MANAGEMENT]: 'Problem Management',
  [ModuleName.CHANGE_ORDERS]: 'Change Orders',
  [ModuleName.MOBILE_TECH]: 'Mobile Tech App',
  [ModuleName.INVOICING]: 'Invoicing & Payments',
  [ModuleName.RMR_BILLING]: 'RMR Billing Engine',
  [ModuleName.SUB_PORTAL]: 'Subcontractor Portal',
  [ModuleName.CUSTOMER_PORTAL]: 'Customer Portal',
  [ModuleName.CONTRACT_BUILDER]: 'Contract Builder',
  [ModuleName.INTEGRATIONS]: 'Integrations',
  [ModuleName.REPORTING]: 'Reporting & KPIs',
}

export const MODULE_DESCRIPTIONS: Record<ModuleName, string> = {
  [ModuleName.OPPORTUNITIES]: 'Pipeline, quotes, CRM',
  [ModuleName.SURVEY]: 'Site survey tool',
  [ModuleName.DESIGN]: 'Engineering canvas',
  [ModuleName.DOCUMENTS]: 'Vault system',
  [ModuleName.PROJECT_MANAGEMENT]: 'Delivery workflow',
  [ModuleName.CALCULATORS]: 'Engineering calculators',
  [ModuleName.CUSTOMER]: 'Customer management',
  [ModuleName.SUBCONTRACTOR]: 'Sub management',
  [ModuleName.FIELD_INSTALL]: 'Install workflow, QC',
  [ModuleName.LEADS_CRM]: 'Lead capture, qualification, conversion',
  [ModuleName.PSA]: 'Full service engine',
  [ModuleName.SERVICE_DESK]: 'Ticket engine, SLA, escalation',
  [ModuleName.DISPATCH]: 'Scheduling, routing, assignment',
  [ModuleName.COMPLIANCE_ENGINE]: 'Licensing, cert tracking',
  [ModuleName.JOB_COSTING]: 'Cost tracking, margins, WIP',
  [ModuleName.PROBLEM_MANAGEMENT]: 'RCA, KEDB, incident patterns',
  [ModuleName.CHANGE_ORDERS]: 'RFC, maintenance windows',
  [ModuleName.MOBILE_TECH]: 'PWA, offline, checklists',
  [ModuleName.INVOICING]: 'Auto-invoice, AR aging, DSO',
  [ModuleName.RMR_BILLING]: 'Recurring revenue, contracts',
  [ModuleName.SUB_PORTAL]: 'Sub compliance, work orders',
  [ModuleName.CUSTOMER_PORTAL]: 'Ticket submit, asset view',
  [ModuleName.CONTRACT_BUILDER]: 'Clause-based doc gen, e-sign',
  [ModuleName.INTEGRATIONS]: 'VMS, ACS, alarm webhooks',
  [ModuleName.REPORTING]: 'Dashboards, QBR auto-gen',
}

// ---- Calculator Labels ----

export const CALCULATOR_LABELS: Record<CalculatorType, string> = {
  [CalculatorType.FOV_DORI]: 'FOV/DORI',
  [CalculatorType.SYSTEM_STORAGE]: 'System/Storage',
  [CalculatorType.WIRING_SCHEMATIC]: 'Wiring Schematic',
  [CalculatorType.MOUNTING]: 'Mounting',
  [CalculatorType.WIRELESS_PTP]: 'Wireless PtP',
  [CalculatorType.CABLE_ESTIMATOR]: 'Cable Estimator',
  [CalculatorType.COVERAGE_AREA]: 'Coverage Area',
  [CalculatorType.PLAN_REVIEW]: 'Compliance Checker',
}

// ---- Division Labels ----

export const DIVISION_LABELS: Record<UserDivision, string> = {
  [UserDivision.SEC]: 'Security',
  [UserDivision.AV]: 'AV',
  [UserDivision.NET]: 'Networking',
  [UserDivision.CYB]: 'Cybersecurity',
  [UserDivision.MSP]: 'MSP',
  [UserDivision.SVC]: 'Service',
  [UserDivision.SALES]: 'Sales',
  [UserDivision.OPS]: 'Operations',
}

// ---- Field Permission Keys ----
// These define which fields are controllable per-role

export interface FieldPermissionGroup {
  group: string
  fields: { key: string; label: string }[]
}

export const FIELD_PERMISSION_GROUPS: FieldPermissionGroup[] = [
  {
    group: 'Opportunity fields',
    fields: [
      { key: 'opp.company_name', label: 'Company name' },
      { key: 'opp.contact_name', label: 'Contact name' },
      { key: 'opp.phone', label: 'Phone' },
      { key: 'opp.email', label: 'Email' },
      { key: 'opp.address', label: 'Address' },
      { key: 'opp.pipeline_stage', label: 'Pipeline stage' },
      { key: 'opp.estimated_value', label: 'Estimated value' },
      { key: 'opp.close_date', label: 'Close date' },
      { key: 'opp.assigned_to', label: 'Assigned to' },
      { key: 'opp.discount', label: 'Discount' },
      { key: 'opp.margin', label: 'Margin' },
    ],
  },
  {
    group: 'Customer fields',
    fields: [
      { key: 'cust.name', label: 'Customer name' },
      { key: 'cust.billing_address', label: 'Billing address' },
      { key: 'cust.primary_contact', label: 'Primary contact' },
      { key: 'cust.account_type', label: 'Account type' },
      { key: 'cust.payment_terms', label: 'Payment terms' },
    ],
  },
  {
    group: 'Project fields',
    fields: [
      { key: 'proj.name', label: 'Project name' },
      { key: 'proj.budget', label: 'Budget' },
      { key: 'proj.start_date', label: 'Start date' },
      { key: 'proj.end_date', label: 'End date' },
      { key: 'proj.status', label: 'Status' },
    ],
  },
]

// ---- Reexport grouped module lists for convenience ----

export { PLATFORM_MODULES, PSA_SUB_MODULES }
