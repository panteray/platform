'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useVendors } from '@/hooks/useVendors'
import { VendorTable } from '@/components/vendors/VendorTable'
import { VendorForm } from '@/components/vendors/VendorForm'

export default function VendorsPage() {
  const router = useRouter()
  const { vendors, loading, createVendor, deleteVendor } = useVendors()
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleCreate(data: Record<string, unknown>) {
    setSaving(true)
    const created = await createVendor(data)
    setSaving(false)
    if (created) {
      setShowCreate(false)
      router.push(`/org/vendors/${created.id}`)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this vendor?')) return
    await deleteVendor(id)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-medium">Vendors</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage vendor relationships and compliance</p>
      </div>
      {showCreate && (
        <div className="mb-4">
          <VendorForm onSave={handleCreate} onCancel={() => setShowCreate(false)} saving={saving} />
        </div>
      )}
      <VendorTable vendors={vendors} loading={loading} onDelete={handleDelete} onCreateClick={() => setShowCreate(true)} />
    </div>
  )
}
