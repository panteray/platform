'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CustomRole } from '@/types/database'

export function useCustomRoles(orgId: string | null) {
  const [roles, setRoles] = useState<CustomRole[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRoles = useCallback(async () => {
    if (!orgId) { setLoading(false); return }
    const supabase = createClient()
    const { data, error } = await supabase
      .from('custom_roles')
      .select('*')
      .eq('org_id', orgId)
      .order('name')

    if (!error && data) setRoles(data)
    setLoading(false)
  }, [orgId])

  useEffect(() => { fetchRoles() }, [fetchRoles])

  return { roles, loading, refresh: fetchRoles }
}
