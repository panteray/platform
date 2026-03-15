'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UserRole, UserDivision } from '@/types/enums'
import { ORG_ASSIGNABLE_ROLES, ROLE_LABELS, requiresDivision } from '@/lib/roles'
import { DIVISION_LABELS } from '@/lib/constants'
import { toast } from 'sonner'
import type { User } from '@/types/database'

interface UserFormProps {
  user?: User | null
  orgId: string
  onSubmit: (data: { email: string; first_name: string; last_name: string; role: UserRole; divisions: UserDivision[]; phone?: string; password?: string }) => void
  onCancel: () => void
}

export function UserForm({ user, orgId, onSubmit, onCancel }: UserFormProps) {
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [role, setRole] = useState<UserRole>(UserRole.FIELD_TECH)
  const [division, setDivision] = useState<UserDivision | ''>('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [settingPassword, setSettingPassword] = useState(false)

  // Sync state when user prop changes (fixes the "doesn't populate" bug)
  useEffect(() => {
    setEmail(user?.email ?? '')
    setFirstName(user?.first_name ?? '')
    setLastName(user?.last_name ?? '')
    setRole(user?.role ?? UserRole.FIELD_TECH)
    setDivision(user?.divisions?.[0] ?? '')
    setPhone(user?.phone ?? '')
    setPassword('')
    setNewPassword('')
  }, [user])

  function handleSubmit() {
    if (!email.trim() || !firstName.trim() || !lastName.trim()) return
    const needsDivision = requiresDivision(role)
    onSubmit({
      email: email.trim(),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      role,
      divisions: needsDivision && division ? [division] : [],
      phone: phone || undefined,
      password: !user && password ? password : undefined,
    })
  }

  async function handleSetPassword() {
    if (!user || !newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setSettingPassword(true)
    const res = await fetch(`/api/admin/users/${user.id}/password`, {
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
      toast.error(err.error ?? 'Failed to update password')
    }
  }

  async function handleSendReset() {
    if (!user) return
    const res = await fetch(`/api/admin/users/${user.id}/reset-password`, { method: 'POST' })
    if (res.ok) toast.success('Password reset email sent')
    else toast.error('Failed to send reset email')
  }

  const showDivision = requiresDivision(role)

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-5 py-3.5 text-sm font-medium">
        {user ? `Edit User — ${user.first_name} ${user.last_name}` : 'Add User'}
      </div>
      <div className="grid gap-4 px-5 py-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label className="text-xs">First name</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Last name</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label className="text-xs">Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!user} autoComplete="off" />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" autoComplete="tel" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
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

        {/* Password on create */}
        {!user && (
          <div className="grid gap-1.5">
            <Label className="text-xs">Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 characters (or leave blank for default)" autoComplete="new-password"
            />
            <p className="text-[10px] text-muted-foreground">
              If left blank, defaults to TempPass123! — user should change on first login.
            </p>
          </div>
        )}

        {/* Password management on edit */}
        {user && (
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <div className="mb-2 text-xs font-medium text-foreground">Password Management</div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-[11px]">Set new password</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min 6 chars)"
                  autoComplete="new-password"
                  className="mt-1"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSetPassword}
                disabled={settingPassword || !newPassword}
              >
                {settingPassword ? 'Setting...' : 'Set'}
              </Button>
            </div>
            <div className="mt-2">
              <Button size="sm" variant="outline" className="w-full text-xs" onClick={handleSendReset}>
                Send password reset email
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-border px-5 py-3">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={handleSubmit}>{user ? 'Save Changes' : 'Create User'}</Button>
      </div>
    </div>
  )
}
