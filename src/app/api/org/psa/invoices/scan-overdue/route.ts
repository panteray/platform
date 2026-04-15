import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/roles'
import { UserRole } from '@/types/enums'

/**
 * POST /api/org/psa/invoices/scan-overdue
 * Transitions any SENT / VIEWED / PARTIAL_PAID invoice whose due_date has
 * passed to OVERDUE. Manager+ only. Manual trigger (no cron yet).
 */
export async function POST(_req: NextRequest) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccess(dbUser.role, UserRole.MANAGER))
    return NextResponse.json({ error: 'Manager role required' }, { status: 403 })

  const admin = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data: candidates, error } = await admin
    .from('invoices')
    .select('id, invoice_number, total, amount_paid, due_date')
    .eq('org_id', dbUser.org_id)
    .in('status', ['SENT', 'VIEWED', 'PARTIAL_PAID'])
    .lt('due_date', today)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const toUpdate = (candidates ?? []).filter(i => Number(i.total ?? 0) - Number(i.amount_paid ?? 0) > 0)
  if (toUpdate.length === 0) {
    return NextResponse.json({ updated: 0, invoices: [] })
  }

  const ids = toUpdate.map(i => i.id)
  const { error: upErr } = await admin
    .from('invoices')
    .update({ status: 'OVERDUE', updated_at: new Date().toISOString() })
    .in('id', ids)

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  return NextResponse.json({
    updated: toUpdate.length,
    invoices: toUpdate.map(i => ({ id: i.id, invoice_number: i.invoice_number })),
  })
}
