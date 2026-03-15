'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { OrgModuleConfig, OrgCalculatorConfig } from '@/types/database'
import type { ModuleName, CalculatorType } from '@/types/enums'

export function useModuleConfig(orgId: string | null) {
  const [modules, setModules] = useState<OrgModuleConfig[]>([])
  const [calculators, setCalculators] = useState<OrgCalculatorConfig[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
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

  useEffect(() => { fetch() }, [fetch])

  const toggleModule = async (moduleName: ModuleName, enabled: boolean) => {
    if (!orgId) return
    const supabase = createClient()
    await supabase
      .from('org_module_config')
      .upsert({ org_id: orgId, module_name: moduleName, enabled }, { onConflict: 'org_id,module_name' })
    await fetch()
  }

  const toggleCalculator = async (calcType: CalculatorType, enabled: boolean) => {
    if (!orgId) return
    const supabase = createClient()
    await supabase
      .from('org_calculator_config')
      .upsert({ org_id: orgId, calculator_type: calcType, enabled }, { onConflict: 'org_id,calculator_type' })
    await fetch()
  }

  const isModuleEnabled = (moduleName: ModuleName): boolean => {
    const mod = modules.find((m) => m.module_name === moduleName)
    return mod?.enabled ?? false
  }

  const isCalcEnabled = (calcType: CalculatorType): boolean => {
    const calc = calculators.find((c) => c.calculator_type === calcType)
    return calc?.enabled ?? false
  }

  return { modules, calculators, loading, toggleModule, toggleCalculator, isModuleEnabled, isCalcEnabled, refresh: fetch }
}
