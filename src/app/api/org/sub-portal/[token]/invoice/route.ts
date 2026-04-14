import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const admin = createAdminClient()

  const { data: tokenRow } = await admin
    .from('sub_portal_tokens')
    .select('*')
    .eq('token', token)
    .eq('is_active', true)
    .maybeSingle()

  if (!tokenRow || new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }

  if (!tokenRow.permissions?.includes('invoice')) {
    return NextResponse.json({ error: 'Invoice submission not permitted' }, { status: 403 })
  }

  // Get current assignment
  const { data: assignment } = await admin
    .from('sub_assignments')
    .select('*')
    .eq('project_id', tokenRow.project_id)
    .eq('sub_id', tokenRow.sub_id)
    .eq('org_id', tokenRow.org_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!assignment) return NextResponse.json({ error: 'No assignment found' }, { status: 404 })

  const invoiceAmount = Number(body.invoice_amount ?? 0)
  const newInvoicedTotal = (assignment.invoiced_amount ?? 0) + invoiceAmount

  // Check PO variance
  if (assignment.po_amount && newInvoicedTotal > assignment.po_amount) {
    const variance = newInvoicedTotal - assignment.po_amount
    const variancePct = (variance / assignment.po_amount) * 100

    await admin
      .from('sub_po_variances')
      .insert({
        org_id: tokenRow.org_id,
        assignment_id: assignment.id,
        project_id: tokenRow.project_id,
        variance_amount: variance,
        variance_pct: variancePct,
        reason: body.notes ?? 'Invoice exceeds PO amount',
      })
  }

  // Update assignment
  const { data, error } = await admin
    .from('sub_assignments')
    .update({
      invoiced_amount: newInvoicedTotal,
      status: 'invoice_received',
    })
    .eq('id', assignment.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
