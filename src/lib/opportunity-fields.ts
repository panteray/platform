/**
 * Opportunity form field definitions by functional role.
 * Used for role-based field visibility and future form generation.
 */

export type FieldType = 'text' | 'number' | 'date' | 'select' | 'textarea' | 'currency' | 'email' | 'phone'

export interface FieldDef {
  key: string
  label: string
  type: FieldType
  group: string
  options?: string[]
}

export type OpportunityRole = 'isr' | 'osr' | 'presales' | 'pm' | 'service' | 'subcontractor'

export const opportunityRoleLabels: Record<OpportunityRole, string> = {
  isr: 'Inside Sales (ISR)',
  osr: 'Outside Sales (OSR)',
  presales: 'Pre-Sales Engineering',
  pm: 'Project Management',
  service: 'Service & Field Ops',
  subcontractor: 'Subcontractor',
}

export const oppIdentityFields: FieldDef[] = [
  { key: 'state', label: 'State', type: 'select', group: 'OPP Identity' },
  { key: 'projectName', label: 'Project Name', type: 'text', group: 'OPP Identity' },
  { key: 'requestType', label: 'Request Type', type: 'select', group: 'OPP Identity', options: ['New Install', 'Upgrade', 'Service', 'Add-On', 'Renewal', 'Consultation'] },
  { key: 'installAddress', label: 'Install Address', type: 'text', group: 'OPP Identity' },
  { key: 'campusBldgRm', label: 'Campus / Bldg / Rm #', type: 'text', group: 'OPP Identity' },
  { key: 'multipleLocations', label: 'Multiple Locations', type: 'select', group: 'OPP Identity', options: ['Yes', 'No'] },
  { key: 'vertical', label: 'Vertical', type: 'select', group: 'OPP Identity', options: ['K12', 'HED', 'GOV', 'BIZ', 'MED', 'SVC'] },
]
