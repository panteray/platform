'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDistributors } from '@/hooks/useDistributors'
import { DistributorTable } from '@/components/distributors/DistributorTable'
import { DistributorForm } from '@/components/distributors/DistributorForm'

export default function DistributorsPage() {
  const router = useRouter()
  const { distributors, loading, createDistributor, deleteDistributor } = useDistributors()
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  async function handleCreate(data: Record<string, unknown>) { setSaving(true); const created = await createDistributor(data); setSaving(false); if (created) { setShowCreate(false); router.push(`/org/distributors/${created.id}`) } }
  async function handleDelete(id: string) { if (!confirm('Delete this distributor?')) return; await deleteDistributor(id) }
  return (
    <div>
      <div className="mb-6"><h1 className="text-lg font-medium">Distributors</h1><p className="mt-1 text-sm text-muted-foreground">Manage distributor accounts and purchasing relationships</p></div>
      {showCreate && <div className="mb-4"><DistributorForm onSave={handleCreate} onCancel={() => setShowCreate(false)} saving={saving} /></div>}
      <DistributorTable distributors={distributors} loading={loading} onDelete={handleDelete} onCreateClick={() => setShowCreate(true)} />
    </div>
  )
}
