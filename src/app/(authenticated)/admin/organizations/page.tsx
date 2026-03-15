'use client'

import { useState } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useOrganizations } from '@/hooks/useOrganizations'
import { OrgTable } from '@/components/admin/OrgTable'
import { OrgForm } from '@/components/admin/OrgForm'
import { Button } from '@/components/ui/button'
import type { Organization } from '@/types/database'

export default function OrganizationsPage() {
  const { organizations, loading, refresh } = useOrganizations()
  const [formOpen, setFormOpen] = useState(false)
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null)

  async function handleCreate(data: { name: string; address?: string; city?: string; state?: string; zip?: string; phone?: string; website?: string }) {
    const res = await fetch('/api/admin/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      toast.success('Organization created')
      refresh()
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Failed to create organization')
    }
  }

  async function handleEdit(data: { name: string; address?: string; city?: string; state?: string; zip?: string; phone?: string; website?: string }) {
    if (!editingOrg) return
    const res = await fetch('/api/admin/organizations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingOrg.id, ...data }),
    })
    if (res.ok) {
      toast.success('Organization updated')
      setEditingOrg(null)
      refresh()
    } else {
      toast.error('Failed to update organization')
    }
  }

  async function handleSuspend(org: Organization) {
    const newStatus = org.status === 'suspended' ? 'active' : 'suspended'
    const res = await fetch(`/api/admin/organizations/${org.id}/suspend`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      toast.success(`Organization ${newStatus}`)
      refresh()
    }
  }

  async function handleDelete(org: Organization) {
    if (!confirm(`Delete "${org.name}"? This cannot be undone.`)) return
    const res = await fetch(`/api/admin/organizations?id=${org.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Organization deleted')
      refresh()
    }
  }

  if (loading) return <div className="text-sm text-muted-foreground">Loading...</div>

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>Home</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Organizations</span>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-medium">Organizations</h1>
        <Button size="sm" className="gap-1.5" onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" /> Add organization
        </Button>
      </div>

      <OrgTable
        organizations={organizations}
        onAdd={() => setFormOpen(true)}
        onEdit={(org) => setEditingOrg(org)}
        onSuspend={handleSuspend}
        onDelete={handleDelete}
      />

      {/* Create dialog */}
      <OrgForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleCreate}
      />

      {/* Edit dialog */}
      <OrgForm
        open={!!editingOrg}
        onOpenChange={(open) => { if (!open) setEditingOrg(null) }}
        org={editingOrg}
        onSubmit={handleEdit}
      />
    </div>
  )
}
