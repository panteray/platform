'use client'
import { Construction } from 'lucide-react'

const STUB_DESCRIPTIONS: Record<string, string> = {
  Surveys: 'Site surveys linked to this opportunity will appear here.',
  Designs: 'Engineering design workspace for this opportunity.',
  'Door Compliance': 'ACS door configuration and compliance tracking.',
  'Hardware Schedule': 'Master hardware schedule and install deliverables.',
  SOW: 'Scope of work and customer-facing SOW documents.',
  BOM: 'Bill of materials and material list for quoting.',
  Project: 'Project number, PM assignment, and project-phase details.',
  Field: 'Field install tasks, daily reports, and QC.',
  'Risk Factors': 'Risk flags and mitigation notes for this opportunity.',
  Huddle: 'Team messaging and collaboration for this opportunity.',
}

export function StubTab({ name }: { name: string }) {
  const subtitle = STUB_DESCRIPTIONS[name] ?? 'This section is planned for a future release.'
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Construction className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-foreground">{name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  )
}
