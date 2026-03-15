'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronRight, Users, LayoutGrid, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { useOrgUsers } from '@/hooks/useOrgUsers'
import { useModuleConfig } from '@/hooks/useModuleConfig'
import { useCustomRoles } from '@/hooks/useCustomRoles'
import { useFieldPermissions } from '@/hooks/useFieldPermissions'
import { OrgUserTable } from '@/components/admin/OrgUserTable'
import { UserForm } from '@/components/admin/UserForm'
import { ModuleToggleGrid } from '@/components/admin/ModuleToggleGrid'
import { CustomRoleTable } from '@/components/admin/CustomRoleTable'
import { RoleForm } from '@/components/admin/RoleForm'
import { FieldPermissionEditor } from '@/components/admin/FieldPermissionEditor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { Organization, User as DbUser, CustomRole } from '@/types/database'
import type { UserRole, UserDivision } from '@/types/enums'

type TabKey = 'users' | 'modules' | 'roles'

const tabDefs: { key: TabKey; label: string; icon: typeof Users }[] = [
  { key: 'users', label: 'Users', icon: Users },
  { key: 'modules', label: 'Modules', icon: LayoutGrid },
  { key: 'roles', label: 'Roles & Permissions', icon: Shield },
]

export default function OrgDetailPage() {
  const params = useParams()
  const router = useRouter()
  const orgId = params.id as string

  // ---- Org state ----
  const [org, setOrg] = useState<Organization | null>(null)
  const [orgName, setOrgName] = useState('')
  const [orgPhone, setOrgPhone] = useState('')
  const [orgAddress, setOrgAddress] = useState('')
  const [orgDescription, setOrgDescription] = useState('')
  const [orgContactName, setOrgContactName] = useState('')
  const [orgContactEmail, setOrgContactEmail] = useState('')
  const [orgContactPhone, setOrgContactPhone] = useState('')

  // ---- Tab + User form state ----
  const [activeTab, setActiveTab] = useState<TabKey>('users')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [roleFormOpen, setRoleFormOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null)

  // ---- Hooks ----
  const { users, loading: usersLoading, refresh: refreshUsers } = useOrgUsers(orgId)
  const { isModuleEnabled, isCalcEnabled, toggleModule, toggleCalculator } = useModuleConfig(orgId)
  const { roles, refresh: refreshRoles } = useCustomRoles(orgId)
  const { getRolePermission, setRolePermission } = useFieldPermissions(orgId)

  // ---- Load org ----
  useEffect(() => {
    async function loadOrg() {
      try {
        const res = await fetch(`/api/admin/organizations/${orgId}`)
        if (res.ok) {
          const data = await res.json()
          if (data.org) {
            const o = data.org as Organization
            setOrg(o)
            setOrgName(o.name)
            setOrgPhone(o.phone ?? '')
            setOrgAddress(o.address ?? '')
            setOrgDescription(o.description ?? '')
            setOrgContactName(o.primary_contact_name ?? '')
            setOrgContactEmail(o.primary_contact_email ?? '')
            setOrgContactPhone(o.primary_contact_phone ?? '')
          }
        }
      } catch { /* silently fail */ }
    }
    loadOrg()
  }, [orgId])

  if (!org) return <div className="text-sm text-muted-foreground">Loading...</div>

  // ---- Org actions ----
  async function handleSaveOrg() {
    const res = await fetch('/api/admin/organizations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: org!.id,
        name: orgName,
        description: orgDescription || undefined,
        phone: orgPhone || undefined,
        address: orgAddress || undefined,
        primary_contact_name: orgContactName || undefined,
        primary_contact_email: orgContactEmail || undefined,
        primary_contact_phone: orgContactPhone || undefined,
      }),
    })
    if (res.ok) {
      const updated = await res.json()
      setOrg(updated)
      toast.success('Organization updated')
    }
  }

  async function handleSuspendOrg() {
    const res = await fetch(`/api/admin/organizations/${org!.id}/suspend`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !org!.is_active }),
    })
    if (res.ok) {
      const updated = await res.json()
      setOrg(updated)
      toast.success(updated.is_active ? 'Organization activated' : 'Organization suspended')
    }
  }

  async function handleDeleteOrg() {
    if (!confirm(`Delete "${org!.name}"? This cannot be undone.`)) return
    const res = await fetch(`/api/admin/organizations?id=${org!.id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Organization deleted'); router.push('/admin/organizations') }
  }

  // ---- User actions ----
  async function handleCreateUser(data: { email: string; first_name: string; last_name: string; role: UserRole; divisions: UserDivision[]; phone?: string; password?: string }) {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, org_id: orgId }),
    })
    if (res.ok) { toast.success('User created'); setShowCreateForm(false); refreshUsers() }
    else { const err = await res.json(); toast.error(err.error ?? 'Failed to create user') }
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

  const roleIdentifiers = [
    { key: 'ORG_ADMIN', label: 'ORG_ADMIN' },
    { key: 'MANAGER', label: 'MANAGER' },
    { key: 'SALES_OSR', label: 'SALES' },
    { key: 'FIELD_TECH', label: 'TECH' },
  ]

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="cursor-pointer text-primary hover:underline" onClick={() => router.push('/admin')}>Home</span>
        <ChevronRight className="h-3 w-3" />
        <span className="cursor-pointer text-primary hover:underline" onClick={() => router.push('/admin/organizations')}>Organizations</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">{org.name}</span>
      </div>

      {/* ============ Inline Org Info Form ============ */}
      <div className="mb-6 rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-medium">Organization Info</span>
            <Badge variant={org.is_active ? 'success' : 'warning'} className="text-[10px]">
              {org.is_active ? 'Active' : 'Suspended'}
            </Badge>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Created {new Date(org.created_at).toLocaleDateString()}
          </span>
        </div>
        <div className="grid gap-4 px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Organization Name</Label>
              <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Phone</Label>
              <Input value={orgPhone} onChange={(e) => setOrgPhone(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Address</Label>
            <Input value={orgAddress} onChange={(e) => setOrgAddress(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea value={orgDescription} onChange={(e) => setOrgDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Primary Contact Name</Label>
              <Input value={orgContactName} onChange={(e) => setOrgContactName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Primary Contact Email</Label>
              <Input value={orgContactEmail} onChange={(e) => setOrgContactEmail(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Primary Contact Phone</Label>
              <Input value={orgContactPhone} onChange={(e) => setOrgContactPhone(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <div className="flex gap-1.5">
            <Button size="sm" onClick={handleSaveOrg}>Save</Button>
            <Button variant="outline" size="sm" className="text-amber-500 hover:text-amber-400" onClick={handleSuspendOrg}>
              {org.is_active ? 'Deactivate' : 'Activate'}
            </Button>
          </div>
          <Button variant="outline" size="sm" className="text-red-500 hover:text-red-400" onClick={handleDeleteOrg}>
            Delete Organization
          </Button>
        </div>
      </div>

      {/* ============ Tabs ============ */}
      <div className="mb-5 flex gap-0 border-b border-border">
        {tabDefs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setShowCreateForm(false) }}
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

      {/* ============ Users Tab ============ */}
      {activeTab === 'users' && (
        <div>
          <OrgUserTable
            users={users}
            onAdd={() => setShowCreateForm(true)}
            onEdit={(u) => router.push(`/admin/organizations/${orgId}/users/${u.id}`)}
            onSuspend={handleSuspendUser}
            onResetPassword={handleResetPassword}
            onDelete={handleDeleteUser}
            getUserHref={(u) => `/admin/organizations/${orgId}/users/${u.id}`}
          />

          {/* Inline create form only — edit goes to detail page */}
          {showCreateForm && (
            <div className="mt-4">
              <UserForm
                key="new"
                orgId={orgId}
                onSubmit={handleCreateUser}
                onCancel={() => setShowCreateForm(false)}
              />
            </div>
          )}
        </div>
      )}

      {/* ============ Modules Tab ============ */}
      {activeTab === 'modules' && (
        <ModuleToggleGrid isModuleEnabled={isModuleEnabled} isCalcEnabled={isCalcEnabled} onToggleModule={toggleModule} onToggleCalc={toggleCalculator} />
      )}

      {/* ============ Roles Tab ============ */}
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

      {/* Role dialogs — kept as dialogs (small forms, not full pages) */}
      <RoleForm open={roleFormOpen} onOpenChange={setRoleFormOpen} onSubmit={handleCreateRole} />
      <RoleForm open={!!editingRole} onOpenChange={(o) => { if (!o) setEditingRole(null) }} role={editingRole} onSubmit={handleEditRole} />
    </div>
  )
}
