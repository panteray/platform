import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/roles'
import { UserRole } from '@/types/enums'

/**
 * Org Compliance Docs — insurance, UL certs, bonds (Phase 8E)
 * GET  /api/org/compliance/org-docs         — list (all roles)
 * POST /api/org/compliance/org-docs         — create (MANAGER+)
 */

const DOC_TYPES = new Set([
  'GENERAL_LIABILITY', 'WORKERS_COMP', 'EO_INSURANCE', 'CYBER_LIABILITY',
  'AUTO_INSURANCE', 'UMBRELLA', 'BOND',
  'UL_827', 'UL_2050', 'UL_294', 'UL_10C', 'OTHER',
])

export async function GET(req: NextRequest) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const docType = req.nextUrl.searchParams.get('doc_type')
  const status = req.nextUrl.searchParams.get('status')

  const admin = createAdminClient()
  let query = admin
    .from('org_compliance_docs')
    .select('*')
    .eq('org_id', dbUser.org_id)
    .order('expiration_date', { ascending: true, nullsFirst: false })

  if (docType) query = query.eq('doc_type', docType)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccess(dbUser.role, UserRole.MANAGER)) {
    return NextResponse.json({ error: 'Manager role required' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const docType = String(body.doc_type || '')
  if (!DOC_TYPES.has(docType)) {
    return NextResponse.json({ error: 'invalid doc_type' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('org_compliance_docs')
    .insert({
      org_id: dbUser.org_id,
      doc_type: docType,
      policy_number: body.policy_number ?? null,
      carrier: body.carrier ?? null,
      coverage_limit: body.coverage_limit ?? null,
      effective_date: body.effective_date ?? null,
      expiration_date: body.expiration_date ?? null,
      audit_due_date: body.audit_due_date ?? null,
      document_url: body.document_url ?? null,
      notes: body.notes ?? null,
      status: body.status ?? 'active',
      created_by: dbUser.id,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
