import { NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/roles'
import { UserRole } from '@/types/enums'

export async function GET() {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!canAccess(dbUser.role as UserRole, UserRole.ORG_MANAGER)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const orgId = dbUser.org_id
  const admin = createAdminClient()

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()
  const nowISO = now.toISOString()

  const TERMINAL_OPP = ['CLOSED_WON', 'CLOSED_LOST', 'CANCELLED']
  const TERMINAL_TICKET = ['RESOLVED', 'CANCELLED']

  // Safe wrappers — if a table doesn't exist yet, return 0 instead of erroring
  async function safeCount(
    fn: () => Promise<{ count: number | null; error: unknown }>
  ): Promise<number> {
    try {
      const { count, error } = await fn()
      if (error) return 0
      return count ?? 0
    } catch {
      return 0
    }
  }

  async function safeQuery<T = Record<string, unknown>>(
    fn: () => Promise<{ data: T[] | null; error: unknown }>
  ): Promise<T[]> {
    try {
      const { data, error } = await fn()
      if (error || !data) return []
      return data
    } catch {
      return []
    }
  }

  const [
    openOpps,
    openOppsData,
    wonThisMonth,
    lostThisMonth,
    activeProjects,
    atRiskProjects,
    openTickets,
    slaBreached,
    expiredLicenses,
    expiredCerts,
    subsOnHold,
    invoicesData,
    contractsData,
  ] = await Promise.all([
    // Revenue pipeline — counts
    safeCount(async () => {
      const r = await admin.from('opportunities').select('*', { count: 'exact', head: true }).eq('org_id', orgId).not('status', 'in', `(${TERMINAL_OPP.join(',')})`)
      return r
    }),
    safeQuery<{ estimated_value: number | null }>(async () => {
      const r = await admin.from('opportunities').select('estimated_value').eq('org_id', orgId).not('status', 'in', `(${TERMINAL_OPP.join(',')})`)
      return r
    }),
    safeCount(async () => {
      const r = await admin.from('opportunities').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'CLOSED_WON').gte('closed_at', startOfMonth).lte('closed_at', endOfMonth)
      return r
    }),
    safeCount(async () => {
      const r = await admin.from('opportunities').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'CLOSED_LOST').gte('closed_at', startOfMonth).lte('closed_at', endOfMonth)
      return r
    }),

    // Projects
    safeCount(async () => {
      const r = await admin.from('projects').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'active')
      return r
    }),
    safeCount(async () => {
      const r = await admin.from('projects').select('*', { count: 'exact', head: true }).eq('org_id', orgId).gt('risk_score', 7)
      return r
    }),

    // Service
    safeCount(async () => {
      const r = await admin.from('psa_tickets').select('*', { count: 'exact', head: true }).eq('org_id', orgId).not('status', 'in', `(${TERMINAL_TICKET.join(',')})`)
      return r
    }),
    safeCount(async () => {
      const r = await admin.from('psa_tickets').select('*', { count: 'exact', head: true }).eq('org_id', orgId).lt('sla_resolution_due', nowISO).not('status', 'in', `(${TERMINAL_TICKET.join(',')})`)
      return r
    }),

    // Compliance
    safeCount(async () => {
      const r = await admin.from('technician_licenses').select('*', { count: 'exact', head: true }).eq('org_id', orgId).lt('expiration_date', nowISO)
      return r
    }),
    safeCount(async () => {
      const r = await admin.from('technician_certifications').select('*', { count: 'exact', head: true }).eq('org_id', orgId).lt('expiration_date', nowISO)
      return r
    }),
    safeCount(async () => {
      const r = await admin.from('subcontractors').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('compliance_hold', true)
      return r
    }),

    // Financial — fetch rows, sum client-side
    safeQuery<{ total: number | null }>(async () => {
      const r = await admin.from('invoices').select('total').eq('org_id', orgId).in('status', ['sent', 'overdue'])
      return r
    }),
    safeQuery<{ monthly_amount: number | null }>(async () => {
      const r = await admin.from('service_contracts').select('monthly_amount').eq('org_id', orgId).eq('status', 'active')
      return r
    }),
  ])

  const openOppsValue = openOppsData.reduce((sum, r) => sum + (Number(r.estimated_value) || 0), 0)
  const outstandingAR = invoicesData.reduce((sum, r) => sum + (Number(r.total) || 0), 0)
  const mrr = contractsData.reduce((sum, r) => sum + (Number(r.monthly_amount) || 0), 0)

  return NextResponse.json({
    open_opps: openOpps,
    open_opps_value: openOppsValue,
    won_this_month: wonThisMonth,
    lost_this_month: lostThisMonth,
    active_projects: activeProjects,
    at_risk_projects: atRiskProjects,
    open_tickets: openTickets,
    sla_breached: slaBreached,
    expired_licenses: expiredLicenses,
    expired_certs: expiredCerts,
    subs_on_hold: subsOnHold,
    outstanding_ar: outstandingAR,
    mrr: mrr,
  })
}
