'use client'

import { useState, useEffect, useCallback } from 'react'
import { DivisionFilter } from '@/components/org/DivisionFilter'
import { EditableDashboard } from '@/components/org/dashboard/EditableDashboard'
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

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div />
        <DivisionFilter value={divisionFilter} onChange={setDivisionFilter} />
      </div>
      <EditableDashboard
        role={(userRole as UserRole | null) ?? null}
        brandColor={brandColor}
        divisionFilter={divisionFilter}
      />
    </div>
  )
}
