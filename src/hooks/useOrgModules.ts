'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { OrgModuleConfig } from '@/types/database'
import type { ModuleName } from '@/types/enums'

interface OrgModulesState {
  modules: OrgModuleConfig[]
  enabledModules: ModuleName[]
  loading: boolean
}

export function useOrgModules(orgId: string | null): OrgModulesState {
  const [state, setState] = useState<OrgModulesState>({
    modules: [],
    enabledModules: [],
    loading: true,
  })

  useEffect(() => {
    if (!orgId) {
      setState({ modules: [], enabledModules: [], loading: false })
      return
    }

    const supabase = createClient()

    async function load() {
      const { data } = await supabase
        .from('org_module_config')
        .select('*')
        .eq('org_id', orgId)

      const all = (data as OrgModuleConfig[]) ?? []
      const enabled = all
        .filter((m) => m.is_enabled)
        .map((m) => m.module)

      setState({
        modules: all,
        enabledModules: enabled,
        loading: false,
      })
    }

    load()
  }, [orgId])

  return state
}
