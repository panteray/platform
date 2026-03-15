'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronRight, Pencil, Pause, Trash2, Users, LayoutGrid, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { useOrgUsers } from '@/hooks/useOrgUsers'
import { useModuleConfig } from '@/hooks/useModuleConfig'
import { useCustomRoles } from '@/hooks/useCustomRoles'
import { useFieldPermissions } from '@/hooks/useFieldPermissions'
import { OrgUserTable } from '@/components/admin/OrgUserTable'
import { UserForm } from '@/components/admin/UserForm'
import { OrgForm } from '@/components/admin/OrgForm'
import { ModuleToggleGrid } from '@/components/admin/ModuleToggleGrid'
import { CustomRoleTable } from '@/components/admin/CustomRoleTable'
import { RoleForm } from '@/components/admin/RoleForm'
import { FieldPermissionEditor } from '@/components/admin/FieldPermissionEditor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Organization, User as DbUser, CustomRole } from '@/types/database'
import type { UserRole, UserDivision } from '@/types/enums'

type TabKey = 'users' | 'modules' | 'roles'

const tabs: { key: TabKey; label: string; icon: typeof Users }[] = [
  { key: 'users', label: 'Users', icon: Users },
  { key: 'modules', label: 'Modules', icon: LayoutGrid },
  { key: 'roles', label: 'Roles & Permissions', icon: Shield },
]

export default function OrgDetailPage() {
  const params = useParams()
  const router = useRouter()
  const orgId = params.id as string

  const [org, setOrg] = useState<Organization | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('users')
  const [editOrgOpen, setEditOrgOpen] = useState(false)
  const [userFormOpen, setUserFormOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<DbUser | null>(null)
  const [roleFormOpen, setRoleFormOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null)

  const { users, loading: usersLoading, refresh: refreshUsers } = useOrgUsers(orgId)
  const { isModuleEnabled, isCalcEnabled, toggleModule, toggleCalculator } = useModuleConfig(orgId)
  const { roles, refresh: refreshRoles } = useCustomRoles(orgId)
  const { getRolePermission, setRolePermission } = useFieldPermissions(orgId)

  useEffect(() => {
    async function loadOrg() {
      try {
        const res = await fetch(`/api/admin/organizations/${orgId}`)
        if (res.ok) {
          const data = await res.json()
          if (data.org) setOrg(data.org)
        }
      } catch { /* silently fail */ }
    }
    loadOrg()
  }, [orgId])

  if (!org) return <div className="text-sm text-muted-foreground">Loading...</div>

  // ---- Org actions ----
  async function handleEditOrg(data: { name: string; description?: string; phone?: string; address?: string; primary_contact_name?: string; primary_contact_email?: string }) {
    const res = await fetch('/api/admin/organizations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: org!.id, ...data }),
    })
    if (res.ok) { const updated = await res.json(); setOrg(updated); toast.success('Organization updated') }
  }

  async function handleSuspendOrg() {
    const res = await fetch(`/api/admin/organizations/${org!.id}/suspend`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !org!.is_active }),
    })
    if (res.ok) { const updated = await res.json(); setOrg(updated); toast.success(updated.is_active ? 'Organization activated' : 'Organization suspended') }
  }

  async function handleDeleteOrg() {
    if (!confirm(`Delete "${org!.name}"? This cannot be undone.`)) return
    const res = await fetch(`/api/admin/organizations?id=${org!.id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Organization deleted'); router.push('/admin/organizations') }
  }

  // ---- User actions ----
  async function handleCreateUser(data: { email: string; first_name: string; last_name: string; role: UserRole; divisions: UserDivision[]; phone?: string }) {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, org_id: orgId }),
    })
    if (res.ok) { toast.success('User created'); refreshUsers() }
    else { const err = await res.json(); toast.error(err.error ?? 'Failed to create user') }
  }

  async function handleEditUser(data: { email: string; first_name: string; last_name: string; role: UserRole; divisions: UserDivision[]; phone?: string }) {
    if (!editingUser) return
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingUser.id, ...data }),
    })
    if (res.ok) { toast.success('User updated'); setEditingUser(null); refreshUsers() }
  }

  async function handleSuspendUser(user: DbUser) {
    const res = await fetch(`/api/admin/users/${user.id}/suspend`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !user.is_active }),
    })
    if (res.ok) { toast.success(user.is_active ? 'User suspended' : 'User activated'); refreshUsers() }
  }

  async function handleResetPassword(user: DbUser) {
    const res = await fetch(`/api/admin/users/${user.id}/reset-password`, { method: 'POST' })
    if (res.ok) toast.success('Password reset email sent')
    else toast.error('Failed to send reset email')
  }

  async function handleDeleteUser(user: DbUser) {
    if (!confirm(`Delete "${user.first_name} ${user.last_name}"?`)) return
    const res = await fetch(`/api/admin/users?id=${user.id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('User deleted'); refreshUsers() }
  }

  // ---- Role actions ----
  async function handleCreateRole(data: { name: string; base_role: UserRole; description: string }) {
    const res = await fetch(`/api/admin/organizations/${orgId}/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) { toast.success('Role created'); refreshRoles() }
    else { const err = await res.json(); toast.error(err.error ?? 'Failed to create role') }
  }

  async function handleEditRole(data: { name: string; base_role: UserRole; description: string }) {
    if (!editingRole) return
    const res = await fetch(`/api/admin/organizations/${orgId}/roles`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_id: editingRole.id, ...data }),
    })
    if (res.ok) { toast.success('Role updated'); setEditingRole(null); refreshRoles() }
  }

  async function handleDeleteRole(role: CustomRole) {
    if (!confirm(`Delete role "${role.name}"?`)) return
    const res = await fetch(`/api/admin/organizations/${orgId}/roles?role_id=${role.id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Role deleted'); refreshRoles() }
  }

  const initials = org.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

  const roleIdentifiers = [
    { key: 'ORG_ADMIN', label: 'ORG_ADMIN' },
    { key: 'MANAGER', label: 'MANAGER' },
    { key: 'SALES_OSR', label: 'SALES' },
    { key: 'FIELD_TECH', label: 'TECH' },
  ]

  return (
    <div>
      <div className="mb-5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="cursor-pointer text-primary hover:underline" onClick={() => router.push('/admin')}>Home</span>
        <ChevronRight className="h-3 w-3" />
        <span className="cursor-pointer text-primary hover:underline" onClick={() => router.push('/admin/organizations')}>Organizations</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">{org.name}</span>
      </div>

      <div className="mb-5 flex items-start justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-muted text-base font-semibold text-muted-foreground">{initials}</div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-medium">{org.name}</h1>
              <Badge variant={org.is_active ? 'success' : 'warning'} className="text-[10px]">
                {org.is_active ? 'Active' : 'Suspended'}
              </Badge>
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {users.length} users &middot; Created {new Date(org.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditOrgOpen(true)}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-amber-500 hover:text-amber-400" onClick={handleSuspendOrg}>
            <Pause className="h-3.5 w-3.5" /> {org.is_active ? 'Suspend' : 'Activate'}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-red-500 hover:text-red-400" onClick={handleDeleteOrg}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      </div>

      <div className="mb-5 flex gap-0 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex items-center gap-1.5 border-b-2 px-5 py-2.5 text-[13px] transition-colors',
              activeTab === tab.key
                ? 'border-primary font-medium text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <tab.icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'users' && (
        <OrgUserTable users={users} onAdd={() => setUserFormOpen(true)} onEdit={(u) => setEditingUser(u)} onSuspend={handleSuspendUser} onResetPassword={handleResetPassword} onDelete={handleDeleteUser} />
      )}
      {activeTab === 'modules' && (
        <ModuleToggleGrid isModuleEnabled={isModuleEnabled} isCalcEnabled={isCalcEnabled} onToggleModule={toggleModule} onToggleCalc={toggleCalculator} />
      )}
      {activeTab === 'roles' && (
        <div className="grid grid-cols-[1fr_1.3fr] gap-5">
          <div>
            <CustomRoleTable roles={roles} onAdd={() => setRoleFormOpen(true)} onEdit={(r) => setEditingRole(r)} onDelete={handleDeleteRole} />
            <div className="mt-5">
              <div className="mb-3 text-sm font-medium">Per-user overrides</div>
              <div className="rounded-lg border border-border bg-card px-5 py-6 text-center text-xs text-muted-foreground">Select a user from the Users tab to set field-level overrides</div>
            </div>
          </div>
          <FieldPermissionEditor roleIdentifiers={roleIdentifiers} getRolePermission={getRolePermission} onSetPermission={setRolePermission} />
        </div>
      )}

      <OrgForm open={editOrgOpen} onOpenChange={setEditOrgOpen} org={org} onSubmit={handleEditOrg} />
      <UserForm open={userFormOpen} onOpenChange={setUserFormOpen} orgId={orgId} onSubmit={handleCreateUser} />
      <UserForm open={!!editingUser} onOpenChange={(o) => { if (!o) setEditingUser(null) }} user={editingUser} orgId={orgId} onSubmit={handleEditUser} />
      <RoleForm open={roleFormOpen} onOpenChange={setRoleFormOpen} onSubmit={handleCreateRole} />
      <RoleForm open={!!editingRole} onOpenChange={(o) => { if (!o) setEditingRole(null) }} role={editingRole} onSubmit={handleEditRole} />
    </div>
  )
}
