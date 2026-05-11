import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_TEMPLATES } from '@/lib/documents/default-templates'
import { GENERATORS } from '@/lib/documents/generators'
import { filenameFor } from '@/lib/documents/generators/types'
import { uploadProjectDocument } from '@/lib/documents/storage'
import type { Customer, DocTemplate, Opportunity, Project, ProjectDocType } from '@/types/database'

const VALID_DOC_TYPES: ProjectDocType[] = [
  'welcome_email',
  'project_workbook',
  'install_reminder',
  'sign_off_sheet',
  'change_order_form',
]

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: projectId } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('project_documents')
    .select('*')
    .eq('org_id', caller.org_id)
    .eq('project_id', projectId)
    .order('doc_type', { ascending: true })
    .order('version', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data ?? [])
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: projectId } = await params
  let body: { doc_type?: string; extra_vars?: Record<string, string> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const docType = body.doc_type as ProjectDocType | undefined
  if (!docType || !VALID_DOC_TYPES.includes(docType)) {
    return NextResponse.json({ error: 'doc_type required (one of: ' + VALID_DOC_TYPES.join(', ') + ')' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: project, error: projectErr } = await admin
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('org_id', caller.org_id)
    .single<Project>()
  if (projectErr || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const [{ data: opportunity }, { data: customer }, { data: org }] = await Promise.all([
    project.opp_id
      ? admin.from('opportunities').select('*').eq('id', project.opp_id).single<Opportunity>()
      : Promise.resolve({ data: null }),
    project.customer_id
      ? admin.from('customers').select('*').eq('id', project.customer_id).single<Customer>()
      : Promise.resolve({ data: null }),
    admin.from('organizations').select('name').eq('id', caller.org_id).single<{ name: string }>(),
  ])

  let pmName: string | null = null
  if (project.pm_id) {
    const { data: pm } = await admin
      .from('users')
      .select('first_name, last_name, email')
      .eq('id', project.pm_id)
      .single<{ first_name: string | null; last_name: string | null; email: string }>()
    if (pm) {
      pmName = [pm.first_name, pm.last_name].filter(Boolean).join(' ').trim() || pm.email
    }
  }

  const template = await loadOrSeedTemplate(admin, caller.org_id, docType, caller.id)

  const generator = GENERATORS[docType]
  const generated = await generator({
    project,
    opportunity: opportunity ?? null,
    customer: customer ?? null,
    pmName,
    orgName: org?.name ?? null,
    template,
    extraVars: body.extra_vars ?? {},
  })

  const { data: existing } = await admin
    .from('project_documents')
    .select('version')
    .eq('project_id', projectId)
    .eq('doc_type', docType)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle<{ version: number }>()

  const nextVersion = (existing?.version ?? 0) + 1
  const filename = filenameFor(docType, nextVersion, generated.ext)

  const { storagePath, byteSize } = await uploadProjectDocument({
    orgId: caller.org_id,
    projectId,
    filename,
    buffer: generated.buffer,
    mimeType: generated.mimeType,
  })

  const { data: inserted, error: insertErr } = await admin
    .from('project_documents')
    .insert({
      org_id: caller.org_id,
      project_id: projectId,
      doc_type: docType,
      version: nextVersion,
      filename,
      storage_path: storagePath,
      mime_type: generated.mimeType,
      byte_size: byteSize,
      generated_by: caller.id,
    })
    .select('*')
    .single()

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 400 })
  return NextResponse.json(inserted, { status: 201 })
}

type AdminClient = ReturnType<typeof createAdminClient>

async function loadOrSeedTemplate(
  admin: AdminClient,
  orgId: string,
  docType: ProjectDocType,
  userId: string,
): Promise<DocTemplate> {
  const { data: existing } = await admin
    .from('doc_templates')
    .select('*')
    .eq('org_id', orgId)
    .eq('doc_type', docType)
    .maybeSingle<DocTemplate>()
  if (existing) return existing

  const defaults = DEFAULT_TEMPLATES[docType]
  const { data: seeded, error } = await admin
    .from('doc_templates')
    .insert({
      org_id: orgId,
      doc_type: docType,
      name: defaults.name,
      body_md: defaults.body_md,
      variables: defaults.variables,
      created_by: userId,
    })
    .select('*')
    .single<DocTemplate>()
  if (error || !seeded) {
    throw new Error(`Failed to seed default template for ${docType}: ${error?.message ?? 'unknown'}`)
  }
  return seeded
}
