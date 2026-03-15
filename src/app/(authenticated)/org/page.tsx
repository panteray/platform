'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { DivisionFilter } from '@/components/org/DivisionFilter'
import { DashboardGrid } from '@/components/org/DashboardGrid'

export default function OrgDashboard() {
  const [divisionFilter, setDivisionFilter] = useState('ALL')

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
        <h1 className="text-lg font-medium">Dashboard</h1>
        <DivisionFilter value={divisionFilter} onChange={setDivisionFilter} />
      </div>

      {/* Editable Grid */}
      <DashboardGrid divisionFilter={divisionFilter} />
    </div>
  )
}
