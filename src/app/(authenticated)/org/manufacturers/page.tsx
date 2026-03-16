'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useManufacturers } from '@/hooks/useManufacturers'
import { ManufacturerTable } from '@/components/manufacturers/ManufacturerTable'
import { ManufacturerForm } from '@/components/manufacturers/ManufacturerForm'

export default function ManufacturersPage() {
  const router = useRouter()
  const { manufacturers, loading, createManufacturer, deleteManufacturer } = useManufacturers()
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  async function handleCreate(data: Record<string, unknown>) { setSaving(true); const created = await createManufacturer(data); setSaving(false); if (created) { setShowCreate(false); router.push(`/org/manufacturers/${created.id}`) } }
  async function handleDelete(id: string) { if (!confirm('Delete this manufacturer?')) return; await deleteManufacturer(id) }
  return (
    <div>
      <div className="mb-6"><h1 className="text-lg font-medium">Manufacturers</h1><p className="mt-1 text-sm text-muted-foreground">Manage manufacturer relationships and compliance</p></div>
      {showCreate && <div className="mb-4"><ManufacturerForm onSave={handleCreate} onCancel={() => setShowCreate(false)} saving={saving} /></div>}
      <ManufacturerTable manufacturers={manufacturers} loading={loading} onDelete={handleDelete} onCreateClick={() => setShowCreate(true)} />
    </div>
  )
}
