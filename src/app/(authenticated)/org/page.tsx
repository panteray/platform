'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronRight } from 'lucide-react'
import { DivisionFilter } from '@/components/org/DivisionFilter'
import { DashboardGrid } from '@/components/org/DashboardGrid'
import { OrgAdminDashboard } from '@/components/org/OrgAdminDashboard'
import { ManagerDashboard } from '@/components/org/ManagerDashboard'
import { SalesDashboard } from '@/components/org/SalesDashboard'
import { PresalesDashboard } from '@/components/org/PresalesDashboard'
import { PMDashboard } from '@/components/org/PMDashboard'
import { FieldDashboard } from '@/components/org/FieldDashboard'
import { useUser } from '@/hooks/useUser'
import { UserRole } from '@/types/enums'
import { createClient } from '@/lib/supabase/client'

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

  // Route to role-specific dashboard
  function renderDashboard() {
    const props = { brandColor, divisionFilter }

    switch (userRole) {
      case UserRole.ORG_ADMIN:
      case UserRole.ORG_MANAGER:
        return <OrgAdminDashboard {...props} />
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
        // Fallback: editable widget grid (original Phase 3 behavior)
        return <DashboardGrid divisionFilter={divisionFilter} />
    }
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>Home</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Dashboard</span>
      </div>

      {/* Header + Filter */}
      <div className="mb-5 flex items-center justify-between">
        <div />
        <DivisionFilter value={divisionFilter} onChange={setDivisionFilter} />
      </div>

      {renderDashboard()}
    </div>
  )
}
