'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCustomers } from '@/hooks/useCustomers'
import { CustomerTable } from '@/components/customers/CustomerTable'
import { CustomerForm } from '@/components/customers/CustomerForm'

export default function CustomersPage() {
  const router = useRouter()
  const { customers, loading, createCustomer, deleteCustomer } = useCustomers()
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleCreate(data: Record<string, unknown>) {
    setSaving(true)
    const created = await createCustomer(data)
    setSaving(false)
    if (created) {
      setShowCreate(false)
      router.push(`/org/customers/${created.id}`)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this customer?')) return
    await deleteCustomer(id)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-medium">Customers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage customer records, contacts, and documents
        </p>
      </div>

      {showCreate && (
        <div className="mb-4">
          <CustomerForm
            onSave={handleCreate}
            onCancel={() => setShowCreate(false)}
            saving={saving}
          />
        </div>
      )}

      <CustomerTable
        customers={customers}
        loading={loading}
        onDelete={handleDelete}
        onCreateClick={() => setShowCreate(true)}
      />
    </div>
  )
}
