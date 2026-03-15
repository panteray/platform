'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@/types/database'

export function useOrgUsers(orgId: string | null) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  const fetchUsers = useCallback(async () => {
    if (!orgId) { setLoading(false); return }
    const supabase = createClient()
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    if (!error && data) setUsers(data)
    setLoading(false)
  }, [orgId])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  return { users, loading, refresh: fetchUsers }
}
