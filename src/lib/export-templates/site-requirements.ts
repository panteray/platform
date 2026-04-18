export type Vertical = 'k12' | 'hed' | 'med' | 'biz' | 'gov'

export const SITE_REQUIREMENTS: Record<Vertical, { title: string; bullets: string[] }> = {
  k12: {
    title: 'K-12 Site Requirements',
    bullets: [
      'Comply with district badging and background check requirements before starting work.',
      'Coordinate work to avoid instructional disruption; comply with bell/testing schedules and restricted areas.',
      'No photos/video of students; protect privacy.',
      'Tools/materials secured at all times; do not leave ladders/tools unattended in occupied areas.',
      'Maintain safe egress; do not block corridors/exits or prop doors.',
      'Replace/secure ceiling tiles same-day where possible.',
    ],
  },
  hed: {
    title: 'Higher Education Site Requirements',
    bullets: [
      'Coordinate access/escort rules and after-hours work with campus facilities/security.',
      'Observe campus access requirements for elevated work, ceiling access, and restricted areas when applicable.',
      'Use signage/barricades where needed in high-traffic areas.',
      'Coordinate network cutovers/testing with campus IT change windows.',
    ],
  },
  med: {
    title: 'Medical / Healthcare Site Requirements',
    bullets: [
      'Follow facility dust-control and cleanliness requirements as directed by site rules.',
      'Coordinate to avoid patient-care disruption; observe restricted zones and quiet hours where applicable.',
      'Do not capture patient information in photos; comply with facility confidentiality rules.',
      'Remove debris daily; restore ceiling tiles immediately when required by facility.',
    ],
  },
  biz: {
    title: 'Commercial / Business Site Requirements',
    bullets: [
      'Coordinate daily start/stop, access, staging, and work areas with the site Point of Contact; minimize disruption to normal operations.',
      'In public or high-traffic areas, control the work zone with signage/barricades as required by site rules; keep pathways clear and safe.',
      'Coordinate with site operations for loading zones, equipment traffic (including powered equipment routes), and restricted areas; do not obstruct operational lanes.',
    ],
  },
  gov: {
    title: 'Government / Secure Facility Site Requirements',
    bullets: [
      'Comply with access/badging/escort rules and restricted-area requirements.',
      'Follow facility rules on devices, photography, and secure areas.',
      'Escalate any scope questions/field changes to HTS PM before action.',
      'Handle devices/media per HTS direction where chain-of-custody is required.',
    ],
  },
}
