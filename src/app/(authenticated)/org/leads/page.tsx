'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLeads } from '@/hooks/useLeads'
import { LeadsTable } from '@/components/leads/LeadsTable'
import { LeadForm } from '@/components/leads/LeadForm'

export default function LeadsPage() {
  const router = useRouter()
  const { leads, loading, createLead, deleteLead } = useLeads()
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleCreate(data: Record<string, unknown>) {
    setSaving(true)
    const created = await createLead(data)
    setSaving(false)
    if (created) {
      setShowCreate(false)
      router.push(`/org/leads/${created.id}`)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this lead?')) return
    await deleteLead(id)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">Leads</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage leads, track pipeline, and convert to opportunities
        </p>
      </div>

      {showCreate && (
        <div className="mb-4">
          <LeadForm
            onSave={handleCreate}
            onCancel={() => setShowCreate(false)}
            saving={saving}
          />
        </div>
      )}

      <LeadsTable
        leads={leads}
        loading={loading}
        onDelete={handleDelete}
        onCreateClick={() => setShowCreate(true)}
      />
    </div>
  )
}
