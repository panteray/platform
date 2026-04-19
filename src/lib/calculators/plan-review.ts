/**
 * Panteray — Plan Review (Compliance Checker) Aggregator
 *
 * Pure rule engine. Loads /public/data/jurisdiction_rules.json and evaluates
 * a project description (devices, doors, controllers, context) against:
 *   • NDAA Section 889 (vendor allowlist)
 *   • NEC 110.26 working space (controllers)
 *   • IBC 1010.1.9.8 delayed egress in Assembly
 *   • NFPA 80 maglocks on fire-rated doors
 *   • IEC 62676-4 recognition PPF
 *   • ADA 309.4 reader reach range
 *   • UL 294 / UL 2050 listing flags
 *
 * No DB. No API. No network calls except the one `fetch` that pulls the
 * static JSON from `/data/jurisdiction_rules.json` (memoized).
 */

// ---- Types ----

export type FindingSeverity = 'critical' | 'warning' | 'info'

export interface PlanReviewFinding {
  ruleId: string
  title: string
  codeRef: string
  severity: FindingSeverity
  message: string
  entityType: 'device' | 'door' | 'controller' | 'project'
  entityId?: string
  entityLabel?: string
  fixHint?: string
}

export interface PlanReviewDevice {
  id: string
  label: string
  category: 'cctv' | 'access_control' | 'servers_nvr' | 'network' | 'av' | 'vape_environmental' | 'other'
  vendor?: string
  model?: string
  ulListed?: boolean
  ndaaCompliant?: boolean | null
  mountHeightIn?: number
  intendedUse?: 'detection' | 'observation' | 'recognition' | 'identification'
  calculatedPpf?: number
}

export interface PlanReviewDoor {
  id: string
  label: string
  electrification?: 'maglock' | 'electric_strike' | 'electrified_lockset' | 'delayed_egress' | 'mechanical'
  fireRated?: boolean
  occupancy?: string
  readerHeightIn?: number
  isPrimaryEgress?: boolean
  hasRex?: boolean
}

export interface PlanReviewController {
  id: string
  label: string
  workingClearanceIn?: number
  ulListed?: boolean
}

export interface PlanReviewInput {
  projectType: 'commercial' | 'federal' | 'education' | 'healthcare' | 'assembly'
  jurisdiction: 'federal' | 'state' | 'local'
  devices: PlanReviewDevice[]
  doors: PlanReviewDoor[]
  controllers: PlanReviewController[]
}

export interface PlanReviewOutput {
  findings: PlanReviewFinding[]
  summary: {
    critical: number
    warning: number
    info: number
    total: number
  }
  rulesEvaluated: number
}

export interface JurisdictionRules {
  version: string
  updated: string
  rules: Record<string, {
    id: string
    title: string
    codeRef: string
    severity: FindingSeverity
    jurisdiction?: string[]
    vendors?: string[]
    prohibitedOccupancies?: string[]
    minClearanceIn?: number
    minPpf?: number
    minHeightIn?: number
    maxHeightIn?: number
    description: string
  }>
}

// ---- Loader (memoized) ----

let cached: JurisdictionRules | null = null
let inflight: Promise<JurisdictionRules> | null = null

export async function loadJurisdictionRules(): Promise<JurisdictionRules> {
  if (cached) return cached
  if (inflight) return inflight
  inflight = fetch('/data/jurisdiction_rules.json')
    .then((r) => (r.ok ? r.json() : EMPTY))
    .then((j: JurisdictionRules) => {
      cached = j
      inflight = null
      return j
    })
    .catch(() => {
      inflight = null
      return EMPTY
    })
  return inflight
}

const EMPTY: JurisdictionRules = { version: '0', updated: '', rules: {} }

// ---- Engine ----

export function runPlanReview(
  input: PlanReviewInput,
  rules: JurisdictionRules,
): PlanReviewOutput {
  const findings: PlanReviewFinding[] = []
  const R = rules.rules

  // Rule 1 — NDAA vendor check (all devices)
  const ndaa = R.NDAA_PROHIBITED_VENDORS
  if (ndaa && ndaa.vendors) {
    const lowerProhibited = ndaa.vendors.map((v) => v.toLowerCase())
    for (const d of input.devices) {
      const v = (d.vendor ?? '').toLowerCase()
      const isMatch = lowerProhibited.some((p) => v.includes(p.toLowerCase()))
      if (isMatch) {
        findings.push({
          ruleId: ndaa.id,
          title: ndaa.title,
          codeRef: ndaa.codeRef,
          severity: ndaa.severity,
          message: `${d.label}: vendor "${d.vendor}" is NDAA-prohibited.`,
          entityType: 'device',
          entityId: d.id,
          entityLabel: d.label,
          fixHint: 'Replace with a Section 889–compliant vendor (Axis, Hanwha, Verkada, Avigilon, etc.).',
        })
      } else if (d.ndaaCompliant === false) {
        findings.push({
          ruleId: ndaa.id,
          title: ndaa.title,
          codeRef: ndaa.codeRef,
          severity: ndaa.severity,
          message: `${d.label}: flagged non-NDAA-compliant in device library.`,
          entityType: 'device',
          entityId: d.id,
          entityLabel: d.label,
        })
      }
    }
  }

  // Rule 2 — NEC 110.26 working space
  const nec = R.NEC_110_26_WORKING_SPACE
  if (nec && typeof nec.minClearanceIn === 'number') {
    for (const c of input.controllers) {
      if (typeof c.workingClearanceIn === 'number' && c.workingClearanceIn < nec.minClearanceIn) {
        findings.push({
          ruleId: nec.id,
          title: nec.title,
          codeRef: nec.codeRef,
          severity: nec.severity,
          message: `${c.label}: working clearance ${c.workingClearanceIn}" is less than required ${nec.minClearanceIn}".`,
          entityType: 'controller',
          entityId: c.id,
          entityLabel: c.label,
          fixHint: `Relocate to a space with at least ${nec.minClearanceIn}" clear in front of the panel.`,
        })
      }
    }
  }

  // Rule 3 — IBC 1010 delayed egress in Assembly
  const ibc = R.IBC_1010_DELAYED_EGRESS_ASSEMBLY
  if (ibc && ibc.prohibitedOccupancies) {
    const proh = ibc.prohibitedOccupancies.map((o) => o.toLowerCase())
    for (const d of input.doors) {
      if (d.electrification === 'delayed_egress' && proh.includes((d.occupancy ?? '').toLowerCase())) {
        findings.push({
          ruleId: ibc.id,
          title: ibc.title,
          codeRef: ibc.codeRef,
          severity: ibc.severity,
          message: `${d.label}: delayed egress lock is prohibited in Assembly occupancy.`,
          entityType: 'door',
          entityId: d.id,
          entityLabel: d.label,
          fixHint: 'Use electrified lockset (ELR) or electric strike instead.',
        })
      }
    }
  }

  // Rule 4 — NFPA 80 maglocks on fire-rated doors
  const nfpa = R.NFPA_80_MAGLOCK_FIRE_RATED
  if (nfpa) {
    for (const d of input.doors) {
      if (d.electrification === 'maglock' && d.fireRated === true) {
        findings.push({
          ruleId: nfpa.id,
          title: nfpa.title,
          codeRef: nfpa.codeRef,
          severity: nfpa.severity,
          message: `${d.label}: maglock installed on fire-rated assembly.`,
          entityType: 'door',
          entityId: d.id,
          entityLabel: d.label,
          fixHint: 'Replace with electrified lockset or electrified trim rated for fire door assemblies.',
        })
      }
    }
  }

  // Rule 5 — IEC 62676-4 recognition PPF
  const iec = R.IEC_62676_4_RECOGNITION_PPF
  if (iec && typeof iec.minPpf === 'number') {
    for (const dv of input.devices) {
      if (
        dv.category === 'cctv' &&
        dv.intendedUse === 'recognition' &&
        typeof dv.calculatedPpf === 'number' &&
        dv.calculatedPpf < iec.minPpf
      ) {
        findings.push({
          ruleId: iec.id,
          title: iec.title,
          codeRef: iec.codeRef,
          severity: iec.severity,
          message: `${dv.label}: ${dv.calculatedPpf} PPF at target — below ${iec.minPpf} PPF recognition threshold.`,
          entityType: 'device',
          entityId: dv.id,
          entityLabel: dv.label,
          fixHint: 'Move camera closer, switch to a narrower lens, or use a higher-resolution sensor.',
        })
      }
    }
  }

  // Rule 6 — ADA 309.4 reader reach range
  const ada = R.ADA_309_4_REACH_RANGE
  if (ada && typeof ada.minHeightIn === 'number' && typeof ada.maxHeightIn === 'number') {
    for (const d of input.doors) {
      if (typeof d.readerHeightIn === 'number') {
        if (d.readerHeightIn < ada.minHeightIn || d.readerHeightIn > ada.maxHeightIn) {
          findings.push({
            ruleId: ada.id,
            title: ada.title,
            codeRef: ada.codeRef,
            severity: ada.severity,
            message: `${d.label}: reader at ${d.readerHeightIn}" — outside ADA range ${ada.minHeightIn}"–${ada.maxHeightIn}".`,
            entityType: 'door',
            entityId: d.id,
            entityLabel: d.label,
            fixHint: `Mount reader between ${ada.minHeightIn}" and ${ada.maxHeightIn}" AFF.`,
          })
        }
      }
    }
  }

  // Rule 7 — UL 294 for access control on federal
  const ul294 = R.UL_294_ACCESS_CONTROL
  if (ul294 && (input.projectType === 'federal' || input.jurisdiction === 'federal')) {
    for (const d of input.devices) {
      if (d.category === 'access_control' && d.ulListed === false) {
        findings.push({
          ruleId: ul294.id,
          title: ul294.title,
          codeRef: ul294.codeRef,
          severity: ul294.severity,
          message: `${d.label}: access control device not marked UL 294 listed.`,
          entityType: 'device',
          entityId: d.id,
          entityLabel: d.label,
        })
      }
    }
  }

  // Rule 8 — UL 2050 monitoring requirement for federal
  const ul2050 = R.UL_2050_HIGH_SECURITY
  if (ul2050 && input.projectType === 'federal') {
    findings.push({
      ruleId: ul2050.id,
      title: ul2050.title,
      codeRef: ul2050.codeRef,
      severity: ul2050.severity,
      message: 'Federal project — verify central station monitoring is UL 2050 listed.',
      entityType: 'project',
      fixHint: 'Confirm UL 2050 certification with the monitoring provider before closeout.',
    })
  }

  const summary = {
    critical: findings.filter((f) => f.severity === 'critical').length,
    warning: findings.filter((f) => f.severity === 'warning').length,
    info: findings.filter((f) => f.severity === 'info').length,
    total: findings.length,
  }

  return {
    findings,
    summary,
    rulesEvaluated: Object.keys(R).length,
  }
}

/** Convenience: synchronous-friendly wrapper that resolves the catalog first */
export async function runPlanReviewAsync(input: PlanReviewInput): Promise<PlanReviewOutput> {
  const rules = await loadJurisdictionRules()
  return runPlanReview(input, rules)
}
