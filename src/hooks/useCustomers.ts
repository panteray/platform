'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Customer } from '@/types/database'

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await fetch('/api/org/customers')
    if (!res.ok) {
      const err = await res.json()
      setError(err.error ?? 'Failed to load customers')
      setLoading(false)
      return
    }
    const data = await res.json()
    setCustomers(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  async function createCustomer(body: Partial<Customer>): Promise<Customer | null> {
    const res = await fetch('/api/org/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return null
    const created = await res.json()
    setCustomers((prev) => [created, ...prev])
    return created
  }

  async function updateCustomer(body: Partial<Customer> & { id: string }): Promise<Customer | null> {
    const res = await fetch('/api/org/customers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return null
    const updated = await res.json()
    setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
    return updated
  }

  async function deleteCustomer(id: string): Promise<boolean> {
    const res = await fetch(`/api/org/customers?id=${id}`, { method: 'DELETE' })
    if (!res.ok) return false
    setCustomers((prev) => prev.filter((c) => c.id !== id))
    return true
  }

  return { customers, loading, error, fetchCustomers, createCustomer, updateCustomer, deleteCustomer }
}
