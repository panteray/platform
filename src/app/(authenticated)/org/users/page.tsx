'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { useUser } from '@/hooks/useUser'
import { canManageUsers } from '@/lib/roles'
import { OrgUserTable } from '@/components/admin/OrgUserTable'
import { UserForm } from '@/components/admin/UserForm'
import type { User as DbUser } from '@/types/database'
import type { UserRole, UserDivision } from '@/types/enums'

export default function OrgUsersPage() {
  const router = useRouter()
  const { userRole, orgId } = useUser()
  const [users, setUsers] = useState<DbUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)

  const canManage = userRole ? canManageUsers(userRole) : false

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/org/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data)
      }
    } catch { /* silently fail */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  async function handleCreateUser(data: { email: string; first_name: string; last_name: string; role: UserRole; divisions: UserDivision[]; phone?: string; password?: string }) {
    const res = await fetch('/api/org/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) { toast.success('User created'); setShowCreateForm(false); fetchUsers() }
    else { const err = await res.json(); toast.error(err.error ?? 'Failed to create user') }
  }

  async function handleSuspendUser(user: DbUser) {
    const res = await fetch(`/api/org/users/${user.id}/suspend`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !user.is_active }),
    })
    if (res.ok) { toast.success(user.is_active ? 'User suspended' : 'User activated'); fetchUsers() }
  }

  async function handleResetPassword(user: DbUser) {
    const res = await fetch(`/api/org/users/${user.id}/reset-password`, { method: 'POST' })
    if (res.ok) toast.success('Password reset email sent')
    else toast.error('Failed to send reset email')
  }

  async function handleDeleteUser(user: DbUser) {
    if (!confirm(`Delete "${user.first_name} ${user.last_name}"?`)) return
    const res = await fetch(`/api/org/users?id=${user.id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('User deleted'); fetchUsers() }
  }

  if (loading) return <div className="text-sm text-muted-foreground">Loading...</div>

  if (!canManage) {
    return (
      <div>
        <div className="mb-5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Home</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">Users</span>
        </div>
        <h1 className="mb-4 text-lg font-medium">Users</h1>
        <div className="rounded-lg border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
          You do not have permission to manage users. Contact your organization admin.
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>Home</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Users</span>
      </div>

      <h1 className="mb-4 text-lg font-medium">Users</h1>

      <OrgUserTable
        users={users}
        onAdd={() => setShowCreateForm(true)}
        onEdit={(u) => router.push(`/org/users/${u.id}`)}
        onSuspend={handleSuspendUser}
        onResetPassword={handleResetPassword}
        onDelete={handleDeleteUser}
        getUserHref={(u) => `/org/users/${u.id}`}
      />

      {/* Inline create form only — edit goes to detail page */}
      {showCreateForm && (
        <div className="mt-4">
          <UserForm
            key="new"
            orgId={orgId ?? ''}
            onSubmit={handleCreateUser}
            onCancel={() => setShowCreateForm(false)}
          />
        </div>
      )}
    </div>
  )
}
