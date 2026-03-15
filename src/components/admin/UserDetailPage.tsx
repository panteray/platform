'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, User as UserIcon, Shield, Wrench, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UserRole, UserDivision } from '@/types/enums'
import { ORG_ASSIGNABLE_ROLES, ROLE_LABELS, requiresDivision } from '@/lib/roles'
import { DIVISION_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { User as DbUser } from '@/types/database'

type TabKey = 'profile' | 'permissions' | 'skills' | 'licenses'

const tabDefs: { key: TabKey; label: string; icon: typeof UserIcon }[] = [
  { key: 'profile', label: 'Profile', icon: UserIcon },
  { key: 'permissions', label: 'Permissions', icon: Shield },
  { key: 'skills', label: 'Skills', icon: Wrench },
  { key: 'licenses', label: 'Licenses', icon: FileText },
]

interface UserDetailPageProps {
  user: DbUser
  backHref: string
  backLabel: string
  apiBase: string // '/api/admin/users' or '/api/org/users'
  apiPasswordBase: string // '/api/admin/users' or '/api/org/users'
  onSaved?: () => void
}

export function UserDetailPage({ user, backHref, backLabel, apiBase, apiPasswordBase, onSaved }: UserDetailPageProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabKey>('profile')

  // Form state
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [title, setTitle] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<UserRole>(UserRole.FIELD_TECH)
  const [division, setDivision] = useState<UserDivision | ''>('')
  const [isActive, setIsActive] = useState(true)

  // Password
  const [newPassword, setNewPassword] = useState('')
  const [settingPassword, setSettingPassword] = useState(false)

  // Sync from prop
  useEffect(() => {
    setFirstName(user.first_name ?? '')
    setLastName(user.last_name ?? '')
    setTitle(user.title ?? '')
    setEmail(user.email)
    setPhone(user.phone ?? '')
    setRole(user.role)
    setDivision(user.divisions?.[0] ?? '')
    setIsActive(user.is_active)
  }, [user])

  const initials = `${(user.first_name?.[0] ?? '').toUpperCase()}${(user.last_name?.[0] ?? '').toUpperCase()}`
  const fullName = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()
  const showDivision = requiresDivision(role)

  async function handleSave() {
    const res = await fetch(apiBase, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: user.id,
        first_name: firstName,
        last_name: lastName,
        title: title || null,
        phone: phone || null,
        role,
        divisions: showDivision && division ? [division] : [],
      }),
    })
    if (res.ok) {
      toast.success('User updated')
      onSaved?.()
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Failed to update user')
    }
  }

  async function handleDeactivate() {
    const res = await fetch(`${apiPasswordBase}/${user.id}/suspend`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !isActive }),
    })
    if (res.ok) {
      const updated = await res.json()
      setIsActive(updated.is_active)
      toast.success(updated.is_active ? 'User activated' : 'User deactivated')
      onSaved?.()
    }
  }

  async function handleSetPassword() {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setSettingPassword(true)
    const res = await fetch(`${apiPasswordBase}/${user.id}/password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword }),
    })
    setSettingPassword(false)
    if (res.ok) {
      toast.success('Password updated')
      setNewPassword('')
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Failed to set password')
    }
  }

  async function handleResetEmail() {
    const res = await fetch(`${apiPasswordBase}/${user.id}/reset-password`, { method: 'POST' })
    if (res.ok) toast.success('Password reset email sent')
    else toast.error('Failed to send reset email')
  }

  return (
    <div>
      {/* Back + Header */}
      <div className="mb-5 flex items-center gap-3">
        <button
          onClick={() => router.push(backHref)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {backLabel}
        </button>
      </div>

      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border-[1.5px] border-blue-500 bg-zinc-900 text-base font-medium text-white">
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-medium">{fullName}</h1>
              <Badge variant="secondary" className="text-[10px]">{ROLE_LABELS[user.role] ?? user.role}</Badge>
              <Badge variant={isActive ? 'success' : 'warning'} className="text-[10px]">
                {isActive ? 'Active' : 'Suspended'}
              </Badge>
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">{user.email}</div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className={isActive ? 'text-red-500 hover:text-red-400' : 'text-emerald-500 hover:text-emerald-400'}
          onClick={handleDeactivate}
        >
          {isActive ? 'Deactivate' : 'Activate'}
        </Button>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-0 border-b border-border">
        {tabDefs.map((tab) => (
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
            <tab.icon className="h-[16px] w-[16px]" strokeWidth={1.5} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="rounded-lg border border-border bg-card">
          {/* User Details Section */}
          <div className="border-b border-border px-5 py-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">User Details</span>
              <button onClick={handleResetEmail} className="text-xs text-primary hover:underline">
                Reset Password
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ORG_ASSIGNABLE_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={isActive ? 'active' : 'suspended'} onValueChange={(v) => setIsActive(v === 'active')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {showDivision && (
                <div className="grid gap-1.5">
                  <Label className="text-xs">Division</Label>
                  <Select value={division} onValueChange={(v) => setDivision(v as UserDivision)}>
                    <SelectTrigger><SelectValue placeholder="Select division" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(DIVISION_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* Identity Section */}
          <div className="border-b border-border px-5 py-4">
            <span className="mb-4 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Identity</span>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">First name</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Last name</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Lead Technician" />
              </div>
            </div>
          </div>

          {/* Contact Section */}
          <div className="border-b border-border px-5 py-4">
            <span className="mb-4 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Contact</span>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Email</Label>
                <Input value={email} disabled className="bg-muted/30" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" />
              </div>
            </div>
          </div>

          {/* Dates Section */}
          <div className="border-b border-border px-5 py-4">
            <span className="mb-4 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Dates</span>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Joined</Label>
                <Input value={new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} disabled className="bg-muted/30" />
              </div>
            </div>
          </div>

          {/* Password Section */}
          <div className="border-b border-border px-5 py-4">
            <span className="mb-4 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Password</span>
            <div className="flex items-end gap-2">
              <div className="max-w-[300px] flex-1">
                <Label className="text-[11px]">Set new password</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min 6 chars)"
                  className="mt-1"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSetPassword}
                disabled={settingPassword || !newPassword}
              >
                {settingPassword ? 'Setting...' : 'Set Password'}
              </Button>
            </div>
          </div>

          {/* Save */}
          <div className="flex justify-end px-5 py-3">
            <Button onClick={handleSave}>Save Changes</Button>
          </div>
        </div>
      )}

      {/* Placeholder Tabs */}
      {activeTab === 'permissions' && (
        <div className="rounded-lg border border-border bg-card px-5 py-12 text-center text-sm text-muted-foreground">
          Field-level permissions coming in a future phase.
        </div>
      )}
      {activeTab === 'skills' && (
        <div className="rounded-lg border border-border bg-card px-5 py-12 text-center text-sm text-muted-foreground">
          Skills and certifications coming in Phase 12b (Compliance Engine).
        </div>
      )}
      {activeTab === 'licenses' && (
        <div className="rounded-lg border border-border bg-card px-5 py-12 text-center text-sm text-muted-foreground">
          License tracking coming in Phase 12b (Compliance Engine).
        </div>
      )}
    </div>
  )
}
