'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RoleFieldPermission, UserFieldPermission, FieldPermissionLevel } from '@/types/database'

export function useFieldPermissions(orgId: string | null) {
  const [rolePerms, setRolePerms] = useState<RoleFieldPermission[]>([])
  const [userPerms, setUserPerms] = useState<UserFieldPermission[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!orgId) { setLoading(false); return }
    const supabase = createClient()

    const [rpRes, upRes] = await Promise.all([
      supabase.from('role_field_permissions').select('*').eq('org_id', orgId),
      supabase.from('user_field_permissions').select('*').eq('org_id', orgId),
    ])

    if (rpRes.data) setRolePerms(rpRes.data)
    if (upRes.data) setUserPerms(upRes.data)
    setLoading(false)
  }, [orgId])

  useEffect(() => { fetchData() }, [fetchData])

  const setRolePermission = async (roleKey: string, fieldKey: string, permission: FieldPermissionLevel) => {
    if (!orgId) return
    const supabase = createClient()
    await supabase.from('role_field_permissions').upsert(
      { org_id: orgId, role_key: roleKey, field_key: fieldKey, permission },
      { onConflict: 'org_id,role_key,field_key' }
    )
    await fetchData()
  }

  const getRolePermission = (roleKey: string, fieldKey: string): FieldPermissionLevel => {
    const perm = rolePerms.find((p) => p.role_key === roleKey && p.field_key === fieldKey)
    return perm?.permission as FieldPermissionLevel ?? '-'
  }

  return { rolePerms, userPerms, loading, setRolePermission, getRolePermission, refresh: fetchData }
}
