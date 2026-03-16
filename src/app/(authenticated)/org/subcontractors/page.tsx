'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSubcontractors } from '@/hooks/useSubcontractors'
import { SubcontractorTable } from '@/components/subcontractors/SubcontractorTable'
import { SubcontractorForm } from '@/components/subcontractors/SubcontractorForm'

export default function SubcontractorsPage() {
  const router = useRouter()
  const { subcontractors, loading, createSubcontractor, deleteSubcontractor } = useSubcontractors()
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleCreate(data: Record<string, unknown>) {
    setSaving(true)
    const created = await createSubcontractor(data)
    setSaving(false)
    if (created) {
      setShowCreate(false)
      router.push(`/org/subcontractors/${created.id}`)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this subcontractor?')) return
    await deleteSubcontractor(id)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-medium">Subcontractors</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage subcontractor onboarding and compliance</p>
      </div>
      {showCreate && (
        <div className="mb-4">
          <SubcontractorForm onSave={handleCreate} onCancel={() => setShowCreate(false)} saving={saving} />
        </div>
      )}
      <SubcontractorTable subcontractors={subcontractors} loading={loading} onDelete={handleDelete} onCreateClick={() => setShowCreate(true)} />
    </div>
  )
}
