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
  onSubmit: (data: { name: string; address?: string; city?: string; state?: string; zip?: string; phone?: string; website?: string }) => void
}

export function OrgForm({ open, onOpenChange, org, onSubmit }: OrgFormProps) {
  const [name, setName] = useState(org?.name ?? '')
  const [phone, setPhone] = useState(org?.phone ?? '')
  const [website, setWebsite] = useState(org?.website ?? '')
  const [address, setAddress] = useState(org?.address ?? '')
  const [city, setCity] = useState(org?.city ?? '')
  const [state, setState] = useState(org?.state ?? '')
  const [zip, setZip] = useState(org?.zip ?? '')

  function handleSubmit() {
    if (!name.trim()) return
    onSubmit({ name: name.trim(), address: address || undefined, city: city || undefined, state: state || undefined, zip: zip || undefined, phone: phone || undefined, website: website || undefined })
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
            <Label htmlFor="org-name">Organization name</Label>
            <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Security" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="org-phone">Phone</Label>
              <Input id="org-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="org-website">Website</Label>
              <Input id="org-website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="acmesec.com" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="org-address">Address</Label>
            <Input id="org-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="org-city">City</Label>
              <Input id="org-city" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="org-state">State</Label>
              <Input id="org-state" value={state} onChange={(e) => setState(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="org-zip">Zip</Label>
              <Input id="org-zip" value={zip} onChange={(e) => setZip(e.target.value)} />
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
