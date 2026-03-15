'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Organization } from '@/types/database'

interface OrgFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  org?: Organization | null
  onSubmit: (data: { name: string; description?: string; phone?: string; address?: string; primary_contact_name?: string; primary_contact_email?: string }) => void
}

export function OrgForm({ open, onOpenChange, org, onSubmit }: OrgFormProps) {
  const [name, setName] = useState(org?.name ?? '')
  const [description, setDescription] = useState(org?.description ?? '')
  const [phone, setPhone] = useState(org?.phone ?? '')
  const [address, setAddress] = useState(org?.address ?? '')
  const [contactName, setContactName] = useState(org?.primary_contact_name ?? '')
  const [contactEmail, setContactEmail] = useState(org?.primary_contact_email ?? '')

  function handleSubmit() {
    if (!name.trim()) return
    onSubmit({
      name: name.trim(),
      description: description || undefined,
      phone: phone || undefined,
      address: address || undefined,
      primary_contact_name: contactName || undefined,
      primary_contact_email: contactEmail || undefined,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{org ? 'Edit organization' : 'Add organization'}</DialogTitle>
          <DialogDescription>{org ? 'Update organization details.' : 'Create a new organization.'}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Organization name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Security" />
          </div>
          <div className="grid gap-2">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Physical security integrator" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" />
            </div>
            <div className="grid gap-2">
              <Label>Address</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Primary contact name</Label>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Primary contact email</Label>
              <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>{org ? 'Save changes' : 'Create'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
