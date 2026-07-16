import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_TEMPLATES } from '@/lib/documents/default-templates'
import { GENERATORS } from '@/lib/documents/generators'
import { filenameFor } from '@/lib/documents/generators/types'
import { uploadProjectDocument } from '@/lib/documents/storage'
import type { Customer, DocTemplate, Opportunity, Project } from '@/types/database'

/**
 * POST /api/cron/start-reminders
 *
 * Invoked daily by pg_cron (see 064_phase4_kickoffs_reminders.sql).
 * Finds projects with a hard-booked scheduling request starting within the
 * next 7 days that have not yet had a Project Start Reminder, generates the
 * install_reminder document for each, and stamps start_reminder_sent_at.
 *
 * Auth: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 */

const REMINDER_WINDOW_DAYS = 7
const EXCLUDED_PROJECT_STATUSES = ['cancelled', 'completed', 'operational_closure']

type AdminClient = ReturnType<typeof createAdminClient>

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || auth !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const today = new Date().toISOString().slice(0, 10)
  const windowEnd = new Date(Date.now() + REMINDER_WINDOW_DAYS * 86400000).toISOString().slice(0, 10)

  const { data: bookings, error: bErr } = await admin
    .from('scheduling_requests')
    .select('project_id, confirmed_start_date, org_id')
    .eq('state', 'hard_book')
    .gte('confirmed_start_date', today)
    .lte('confirmed_start_date', windowEnd)
  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 400 })

  const projectIds = [...new Set((bookings ?? []).map((b) => b.project_id))]
  if (projectIds.length === 0) return NextResponse.json({ processed: 0, results: [] })

  const { data: projects, error: pErr } = await admin
    .from('projects')
    .select('*')
    .in('id', projectIds)
    .is('start_reminder_sent_at', null)
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 })

  const due = (projects ?? []).filter((p) => !EXCLUDED_PROJECT_STATUSES.includes(p.status))

  const results: { project_id: string; pn: string | null; ok: boolean; error?: string }[] = []

  for (const project of due as Project[]) {
    try {
      await generateInstallReminder(admin, project)
      await admin
        .from('projects')
        .update({ start_reminder_sent_at: new Date().toISOString() })
        .eq('id', project.id)
      results.push({ project_id: project.id, pn: project.pn, ok: true })
    } catch (e) {
      results.push({ project_id: project.id, pn: project.pn, ok: false, error: e instanceof Error ? e.message : String(e) })
    }
  }

  return NextResponse.json({ processed: results.length, results })
}

async function generateInstallReminder(admin: AdminClient, project: Project) {
  const [{ data: opportunity }, { data: customer }, { data: org }] = await Promise.all([
    project.opp_id
      ? admin.from('opportunities').select('*').eq('id', project.opp_id).single<Opportunity>()
      : Promise.resolve({ data: null }),
    project.customer_id
      ? admin.from('customers').select('*').eq('id', project.customer_id).single<Customer>()
      : Promise.resolve({ data: null }),
    admin.from('organizations').select('name').eq('id', project.org_id).single<{ name: string }>(),
  ])

  let pmName: string | null = null
  if (project.pm_id) {
    const { data: pm } = await admin
      .from('users')
      .select('first_name, last_name, email')
      .eq('id', project.pm_id)
      .single<{ first_name: string | null; last_name: string | null; email: string }>()
    if (pm) pmName = [pm.first_name, pm.last_name].filter(Boolean).join(' ').trim() || pm.email
  }

  const template = await loadOrSeedTemplate(admin, project.org_id)

  const generator = GENERATORS['install_reminder']
  const generated = await generator({
    project,
    opportunity: opportunity ?? null,
    customer: customer ?? null,
    pmName,
    orgName: org?.name ?? null,
    template,
    extraVars: {},
  })

  const { data: existing } = await admin
    .from('project_documents')
    .select('version')
    .eq('project_id', project.id)
    .eq('doc_type', 'install_reminder')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle<{ version: number }>()

  const nextVersion = (existing?.version ?? 0) + 1
  const filename = filenameFor('install_reminder', nextVersion, generated.ext)

  const { storagePath, byteSize } = await uploadProjectDocument({
    orgId: project.org_id,
    projectId: project.id,
    filename,
    buffer: generated.buffer,
    mimeType: generated.mimeType,
  })

  const { error: insertErr } = await admin.from('project_documents').insert({
    org_id: project.org_id,
    project_id: project.id,
    doc_type: 'install_reminder',
    version: nextVersion,
    filename,
    storage_path: storagePath,
    mime_type: generated.mimeType,
    byte_size: byteSize,
    generated_by: null,
  })
  if (insertErr) throw new Error(insertErr.message)
}

async function loadOrSeedTemplate(admin: AdminClient, orgId: string): Promise<DocTemplate> {
  const { data: existing } = await admin
    .from('doc_templates')
    .select('*')
    .eq('org_id', orgId)
    .eq('doc_type', 'install_reminder')
    .maybeSingle<DocTemplate>()
  if (existing) return existing

  const defaults = DEFAULT_TEMPLATES['install_reminder']
  const { data: seeded, error } = await admin
    .from('doc_templates')
    .insert({
      org_id: orgId,
      doc_type: 'install_reminder',
      name: defaults.name,
      body_md: defaults.body_md,
      variables: defaults.variables,
      created_by: null,
    })
    .select('*')
    .single<DocTemplate>()
  if (error || !seeded) throw new Error(error?.message ?? 'Failed to seed install_reminder template')
  return seeded
}
