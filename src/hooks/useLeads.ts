'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Lead } from '@/types/database'

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await fetch('/api/org/leads')
    if (!res.ok) {
      const err = await res.json()
      setError(err.error ?? 'Failed to load leads')
      setLoading(false)
      return
    }
    const data = await res.json()
    setLeads(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  async function createLead(body: Partial<Lead>): Promise<Lead | null> {
    const res = await fetch('/api/org/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return null
    const created = await res.json()
    setLeads((prev) => [created, ...prev])
    return created
  }

  async function updateLead(body: Partial<Lead> & { id: string }): Promise<Lead | null> {
    const res = await fetch('/api/org/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return null
    const updated = await res.json()
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
    return updated
  }

  async function deleteLead(id: string): Promise<boolean> {
    const res = await fetch(`/api/org/leads?id=${id}`, { method: 'DELETE' })
    if (!res.ok) return false
    setLeads((prev) => prev.filter((l) => l.id !== id))
    return true
  }

  async function transitionLead(id: string, newStatus: string): Promise<Lead | null> {
    const res = await fetch('/api/org/leads/transition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus }),
    })
    if (!res.ok) return null
    const updated = await res.json()
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
    return updated
  }

  return { leads, loading, error, fetchLeads, createLead, updateLead, deleteLead, transitionLead }
}
