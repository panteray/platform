'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { OrgModuleConfig, OrgCalculatorConfig } from '@/types/database'
import type { ModuleName, CalculatorType } from '@/types/enums'

export function useModuleConfig(orgId: string | null) {
  const [modules, setModules] = useState<OrgModuleConfig[]>([])
  const [calculators, setCalculators] = useState<OrgCalculatorConfig[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!orgId) { setLoading(false); return }
    const supabase = createClient()

    const [modRes, calcRes] = await Promise.all([
      supabase.from('org_module_config').select('*').eq('org_id', orgId),
      supabase.from('org_calculator_config').select('*').eq('org_id', orgId),
    ])

    if (modRes.data) setModules(modRes.data)
    if (calcRes.data) setCalculators(calcRes.data)
    setLoading(false)
  }, [orgId])

  useEffect(() => { fetchData() }, [fetchData])

  const toggleModule = async (moduleName: ModuleName, enabled: boolean) => {
    if (!orgId) return
    const supabase = createClient()
    await supabase
      .from('org_module_config')
      .upsert({ org_id: orgId, module: moduleName, is_enabled: enabled }, { onConflict: 'org_id,module' })
    await fetchData()
  }

  const toggleCalculator = async (calcType: CalculatorType, enabled: boolean) => {
    if (!orgId) return
    const supabase = createClient()
    await supabase
      .from('org_calculator_config')
      .upsert({ org_id: orgId, calculator_type: calcType, is_enabled: enabled }, { onConflict: 'org_id,calculator_type' })
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
