'use client'

import { useState, useEffect, useCallback } from 'react'
import type { RoleFieldPermission, UserFieldPermission, FieldPermissionLevel } from '@/types/database'

export function useFieldPermissions(orgId: string | null) {
  const [rolePerms, setRolePerms] = useState<RoleFieldPermission[]>([])
  const [userPerms, setUserPerms] = useState<UserFieldPermission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!orgId) { setLoading(false); return }
    try {
      setError(null)
      const res = await fetch(`/api/admin/organizations/${orgId}`)
      if (res.ok) {
        const data = await res.json()
        setRolePerms(data.rolePermissions ?? [])
        setUserPerms(data.userPermissions ?? [])
      } else {
        setError('Failed to load permissions')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load permissions')
    }
    setLoading(false)
  }, [orgId])

  useEffect(() => { fetchData() }, [fetchData])

  const setRolePermission = async (roleKey: string, fieldKey: string, permission: FieldPermissionLevel) => {
    if (!orgId) return
    await fetch(`/api/admin/organizations/${orgId}/permissions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_key: roleKey, field_key: fieldKey, permission }),
    })
    await fetchData()
  }

  const getRolePermission = (roleKey: string, fieldKey: string): FieldPermissionLevel => {
    const perm = rolePerms.find((p) => p.role_key === roleKey && p.field_key === fieldKey)
    return (perm?.permission ?? '-') as FieldPermissionLevel
  }

  return { rolePerms, userPerms, loading, error, setRolePermission, getRolePermission, refresh: fetchData }
}
