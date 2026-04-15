/**
 * Panteray — PSA Skill Taxonomy
 *
 * Standardized skill catalog for psa_tech_skills + psa_tickets.required_skills.
 * Used to filter tech assignments in dispatch and to compute eligible techs
 * during customer self-scheduling.
 *
 * Skills are grouped by vertical but the stored value is the flat `label`.
 * Free-form entries are still permitted in the DB — this is a UX anchor, not
 * a hard constraint.
 */

export type PsaSkillVertical = 'SEC' | 'NET' | 'AV' | 'CYB' | 'MSP' | 'SVC'

export interface PsaSkill {
  vertical: PsaSkillVertical
  label: string
}

export const PSA_SKILLS: PsaSkill[] = [
  // Security — CCTV + access control
  { vertical: 'SEC', label: 'CCTV Install' },
  { vertical: 'SEC', label: 'CCTV Aiming & Focus' },
  { vertical: 'SEC', label: 'VMS Setup — Genetec' },
  { vertical: 'SEC', label: 'VMS Setup — Milestone' },
  { vertical: 'SEC', label: 'VMS Setup — Verkada' },
  { vertical: 'SEC', label: 'VMS Setup — Avigilon' },
  { vertical: 'SEC', label: 'Access Control Wiring' },
  { vertical: 'SEC', label: 'ACS Config — Mercury' },
  { vertical: 'SEC', label: 'ACS Config — HID' },
  { vertical: 'SEC', label: 'ACS Config — Brivo' },
  { vertical: 'SEC', label: 'Door Hardware — Maglock' },
  { vertical: 'SEC', label: 'Door Hardware — Electric Strike' },
  { vertical: 'SEC', label: 'Intercom / Entry Station' },

  // Network — cable, switching, wireless
  { vertical: 'NET', label: 'Low Voltage Cable Pull' },
  { vertical: 'NET', label: 'Fiber Termination' },
  { vertical: 'NET', label: 'Copper Termination (Cat5e/6/6a)' },
  { vertical: 'NET', label: 'Rack & Stack' },
  { vertical: 'NET', label: 'Switch Configuration' },
  { vertical: 'NET', label: 'PoE Budgeting' },
  { vertical: 'NET', label: 'Wireless Access Point Install' },
  { vertical: 'NET', label: 'Point-to-Point Wireless (PtP)' },

  // AV — audio, displays, control systems
  { vertical: 'AV', label: 'Display Mounting' },
  { vertical: 'AV', label: 'Audio DSP Programming' },
  { vertical: 'AV', label: 'Control System — Crestron' },
  { vertical: 'AV', label: 'Control System — Extron' },
  { vertical: 'AV', label: 'Conference Room Setup' },

  // Cybersecurity
  { vertical: 'CYB', label: 'Network Security Assessment' },
  { vertical: 'CYB', label: 'Firewall Configuration' },
  { vertical: 'CYB', label: 'VLAN Segmentation' },

  // MSP / IT
  { vertical: 'MSP', label: 'Server Install & Config' },
  { vertical: 'MSP', label: 'Workstation Deployment' },
  { vertical: 'MSP', label: 'Backup & Recovery' },

  // Service — general
  { vertical: 'SVC', label: 'Preventive Maintenance' },
  { vertical: 'SVC', label: 'Firmware Update' },
  { vertical: 'SVC', label: 'Troubleshooting — General' },
]

/** Flat list of labels for quick membership / filter ops. */
export const PSA_SKILL_LABELS: string[] = PSA_SKILLS.map((s) => s.label)

/** Group skills by vertical for rendering in checkbox groups. */
export function groupSkillsByVertical(): Record<PsaSkillVertical, string[]> {
  const out: Record<PsaSkillVertical, string[]> = {
    SEC: [], NET: [], AV: [], CYB: [], MSP: [], SVC: [],
  }
  for (const s of PSA_SKILLS) out[s.vertical].push(s.label)
  return out
}

export const PSA_SKILL_VERTICAL_LABELS: Record<PsaSkillVertical, string> = {
  SEC: 'Security',
  NET: 'Network',
  AV: 'AV',
  CYB: 'Cybersecurity',
  MSP: 'MSP / IT',
  SVC: 'Service',
}

/**
 * Given a set of required skills and a tech's skill list, return the skills
 * the tech is missing. Empty array means the tech covers everything.
 */
export function missingSkills(required: string[], techSkills: string[]): string[] {
  if (!required || required.length === 0) return []
  const techSet = new Set(techSkills)
  return required.filter((r) => !techSet.has(r))
}
