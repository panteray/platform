'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { DivisionFilter } from '@/components/org/DivisionFilter'
import { DashboardGrid } from '@/components/org/DashboardGrid'
import { useUser } from '@/hooks/useUser'
import { UserRole } from '@/types/enums'
import { createClient } from '@/lib/supabase/client'

const OrgAdminDashboard = dynamic(() => import('@/components/org/OrgAdminDashboard').then(m => ({ default: m.OrgAdminDashboard })))
const ManagerDashboard = dynamic(() => import('@/components/org/ManagerDashboard').then(m => ({ default: m.ManagerDashboard })))
const SalesDashboard = dynamic(() => import('@/components/org/SalesDashboard').then(m => ({ default: m.SalesDashboard })))
const PresalesDashboard = dynamic(() => import('@/components/org/PresalesDashboard').then(m => ({ default: m.PresalesDashboard })))
const PMDashboard = dynamic(() => import('@/components/org/PMDashboard').then(m => ({ default: m.PMDashboard })))
const FieldDashboard = dynamic(() => import('@/components/org/FieldDashboard').then(m => ({ default: m.FieldDashboard })))
const ExecutiveDashboard = dynamic(() => import('@/components/org/ExecutiveDashboard').then(m => ({ default: m.ExecutiveDashboard })))

export default function OrgDashboard() {
  const [divisionFilter, setDivisionFilter] = useState('ALL')
  const { userRole, orgId } = useUser()
  const [brandColor, setBrandColor] = useState<string | null>(null)

  const loadBrandColor = useCallback(async () => {
    if (!orgId) return
    const supabase = createClient()
    const { data } = await supabase
      .from('organizations')
      .select('brand_color')
      .eq('id', orgId)
      .single()
    setBrandColor(data?.brand_color ?? null)
  }, [orgId])

  useEffect(() => {
    loadBrandColor()
  }, [loadBrandColor])

  function renderDashboard() {
    const props = { brandColor, divisionFilter }

    switch (userRole) {
      case UserRole.ORG_ADMIN:
      case UserRole.ORG_MANAGER:
        return <ExecutiveDashboard {...props} />
      case UserRole.MANAGER:
      case UserRole.OPERATIONS:
        return <ManagerDashboard {...props} />
      case UserRole.SALES_ISR:
      case UserRole.SALES_OSR:
        return <SalesDashboard {...props} />
      case UserRole.PRESALES:
        return <PresalesDashboard {...props} />
      case UserRole.PROJECT_MANAGER:
        return <PMDashboard {...props} />
      case UserRole.TECH_SUP:
        return <ManagerDashboard {...props} />
      case UserRole.LEAD:
      case UserRole.FIELD_TECH:
        return <FieldDashboard {...props} />
      case UserRole.SUBCONTRACTOR:
      case UserRole.CUSTOMER:
        return <FieldDashboard {...props} />
      default:
        return <DashboardGrid divisionFilter={divisionFilter} />
    }
  }

  return (
    <div>
      {/* Header + Filter */}
      <div className="mb-5 flex items-center justify-between">
        <div />
        <DivisionFilter value={divisionFilter} onChange={setDivisionFilter} />
      </div>

      {renderDashboard()}
    </div>
  )
}
