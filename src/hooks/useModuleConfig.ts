'use client'

import { useState, useEffect, useCallback } from 'react'
import type { OrgModuleConfig, OrgCalculatorConfig } from '@/types/database'
import type { ModuleName, CalculatorType } from '@/types/enums'

export function useModuleConfig(orgId: string | null) {
  const [modules, setModules] = useState<OrgModuleConfig[]>([])
  const [calculators, setCalculators] = useState<OrgCalculatorConfig[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!orgId) { setLoading(false); return }
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}`)
      if (res.ok) {
        const data = await res.json()
        setModules(data.modules ?? [])
        setCalculators(data.calculators ?? [])
      }
    } catch { /* silently fail */ }
    setLoading(false)
  }, [orgId])

  useEffect(() => { fetchData() }, [fetchData])

  const toggleModule = async (moduleName: ModuleName, enabled: boolean) => {
    if (!orgId) return
    await fetch(`/api/admin/organizations/${orgId}/modules`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'module', module: moduleName, is_enabled: enabled }),
    })
    await fetchData()
  }

  const toggleCalculator = async (calcType: CalculatorType, enabled: boolean) => {
    if (!orgId) return
    await fetch(`/api/admin/organizations/${orgId}/modules`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'calculator', calculator_type: calcType, is_enabled: enabled }),
    })
    await fetchData()
  }

  const isModuleEnabled = (moduleName: ModuleName): boolean => {
    const mod = modules.find((m) => m.module === moduleName)
    return mod?.is_enabled ?? false
  }

  const isCalcEnabled = (calcType: CalculatorType): boolean => {
    const calc = calculators.find((c) => c.calculator_type === calcType)
    return calc?.is_enabled ?? false
  }

  return { modules, calculators, loading, toggleModule, toggleCalculator, isModuleEnabled, isCalcEnabled, refresh: fetchData }
}
