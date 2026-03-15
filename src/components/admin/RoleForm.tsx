'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UserRole } from '@/types/enums'
import { ORG_ASSIGNABLE_ROLES, ROLE_LABELS } from '@/lib/roles'
import type { CustomRole } from '@/types/database'

interface RoleFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  role?: CustomRole | null
  onSubmit: (data: { name: string; base_role: UserRole; description: string }) => void
}

export function RoleForm({ open, onOpenChange, role, onSubmit }: RoleFormProps) {
  const [name, setName] = useState(role?.name ?? '')
  const [baseRole, setBaseRole] = useState<UserRole>(role?.base_role ?? UserRole.FIELD_TECH)
  const [description, setDescription] = useState(role?.description ?? '')

  function handleSubmit() {
    if (!name.trim()) return
    onSubmit({ name: name.trim(), base_role: baseRole, description: description.trim() })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{role ? 'Edit custom role' : 'Create custom role'}</DialogTitle>
          <DialogDescription>Custom roles inherit permissions from a base role.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Role name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Senior Installer" />
          </div>
          <div className="grid gap-2">
            <Label>Base role (inherits from)</Label>
            <Select value={baseRole} onValueChange={(v) => setBaseRole(v as UserRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ORG_ASSIGNABLE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this role does..." rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>{role ? 'Save changes' : 'Create role'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
