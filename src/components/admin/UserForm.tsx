'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UserRole, UserDivision } from '@/types/enums'
import { ORG_ASSIGNABLE_ROLES, ROLE_LABELS } from '@/lib/roles'
import { DIVISION_LABELS } from '@/lib/constants'
import { toast } from 'sonner'
import type { User } from '@/types/database'

interface UserFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user?: User | null
  orgId: string
  onSubmit: (data: { email: string; first_name: string; last_name: string; role: UserRole; divisions: UserDivision[]; phone?: string; password?: string }) => void
}

export function UserForm({ open, onOpenChange, user, orgId, onSubmit }: UserFormProps) {
  const [email, setEmail] = useState(user?.email ?? '')
  const [firstName, setFirstName] = useState(user?.first_name ?? '')
  const [lastName, setLastName] = useState(user?.last_name ?? '')
  const [role, setRole] = useState<UserRole>(user?.role ?? UserRole.FIELD_TECH)
  const [division, setDivision] = useState<UserDivision | ''>(user?.divisions?.[0] ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [settingPassword, setSettingPassword] = useState(false)

  function handleSubmit() {
    if (!email.trim() || !firstName.trim() || !lastName.trim()) return
    onSubmit({
      email: email.trim(),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      role,
      divisions: division ? [division] : [],
      phone: phone || undefined,
      password: !user && password ? password : undefined,
    })
    onOpenChange(false)
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user ? 'Edit user' : 'Add user'}</DialogTitle>
          <DialogDescription>{user ? 'Update user details.' : 'Create a new user in this organization.'}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>First name</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Last name</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!user} />
          </div>

          {/* Password on create */}
          {!user && (
            <div className="grid gap-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 characters (or leave blank for default)"
              />
              <p className="text-[10px] text-muted-foreground">
                If left blank, defaults to TempPass123! — user should change on first login.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ORG_ASSIGNABLE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Division</Label>
              <Select value={division} onValueChange={(v) => setDivision(v as UserDivision)}>
                <SelectTrigger><SelectValue placeholder="Select division" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DIVISION_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" />
          </div>

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
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>{user ? 'Save changes' : 'Create user'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
