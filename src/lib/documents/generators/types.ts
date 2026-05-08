import type { Customer, DocTemplate, Opportunity, Project, ProjectDocType } from '@/types/database'

export interface GeneratorContext {
  project: Project
  opportunity: Opportunity | null
  customer: Customer | null
  pmName: string | null
  orgName: string | null
  template: DocTemplate
  /** Caller-supplied fields (e.g. for a CO: co_number, co_description, co_amount). */
  extraVars: Record<string, string>
}

export interface GeneratedDoc {
  buffer: Buffer
  ext: 'docx' | 'xlsx'
  mimeType: string
}

export type Generator = (ctx: GeneratorContext) => Promise<GeneratedDoc>

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export function buildVarMap(ctx: GeneratorContext): Record<string, string> {
  const today = new Date().toISOString().slice(0, 10)
  const project = ctx.project
  const opp = ctx.opportunity
  const customer = ctx.customer
  const siteAddress = [project.site_address, project.site_city, project.site_state, project.site_zip]
    .filter(Boolean)
    .join(', ')
  return {
    project_name: project.name ?? '',
    project_number: project.pn ?? opp?.project_number ?? '',
    customer_name: customer?.name ?? opp?.customer_name ?? '',
    site_address: siteAddress || opp?.install_address || '',
    pm_name: ctx.pmName ?? '',
    org_name: ctx.orgName ?? '',
    today,
    ...ctx.extraVars,
  }
}

export function filenameFor(docType: ProjectDocType, version: number, ext: 'docx' | 'xlsx'): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `${docType}_v${version}_${date}.${ext}`
}
