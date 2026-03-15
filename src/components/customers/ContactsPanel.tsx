'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, Star, X } from 'lucide-react'
import type { Contact, EntityType } from '@/types/database'

interface ContactsPanelProps {
  entityType: EntityType
  entityId: string
}

export function ContactsPanel({ entityType, entityId }: ContactsPanelProps) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', title: '', phone: '', email: '', is_primary: false, notes: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/org/contacts?entity_type=${entityType}&entity_id=${entityId}`)
    if (res.ok) setContacts(await res.json())
    setLoading(false)
  }, [entityType, entityId])

  useEffect(() => { load() }, [load])

  function resetForm() {
    setForm({ name: '', title: '', phone: '', email: '', is_primary: false, notes: '' })
    setShowForm(false)
    setEditId(null)
  }

  function startEdit(c: Contact) {
    setForm({ name: c.name, title: c.title ?? '', phone: c.phone ?? '', email: c.email ?? '', is_primary: c.is_primary, notes: c.notes ?? '' })
    setEditId(c.id)
    setShowForm(true)
  }

  async function handleSave() {
    const method = editId ? 'PATCH' : 'POST'
    const body = editId
      ? { id: editId, ...form }
      : { entity_type: entityType, entity_id: entityId, ...form }
    const res = await fetch('/api/org/contacts', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) { resetForm(); load() }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/org/contacts?id=${id}`, { method: 'DELETE' })
    if (res.ok) load()
  }

  const inputCls = 'h-8 w-full rounded border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring'

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-[13px] font-semibold text-foreground">Contacts</h3>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="rounded p-1 hover:bg-muted">
          <Plus className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {showForm && (
        <div className="border-b border-border p-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <input className={inputCls} placeholder="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />
            <input className={inputCls} placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoComplete="off" />
            <input className={inputCls} placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" />
            <input className={inputCls} placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="off" />
          </div>
          <div className="mt-2 flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" checked={form.is_primary} onChange={(e) => setForm({ ...form, is_primary: e.target.checked })} />
              Primary contact
            </label>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={resetForm} className="h-7 rounded border border-border px-3 text-xs hover:bg-muted">Cancel</button>
            <button onClick={handleSave} disabled={!form.name.trim()} className="h-7 rounded bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {editId ? 'Save' : 'Add'}
            </button>
          </div>
        </div>
      )}

      <div className="divide-y divide-border">
        {loading ? (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">Loading...</div>
        ) : contacts.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">No contacts added yet.</div>
        ) : (
          contacts.map((c) => (
            <div key={c.id} className="flex items-start justify-between px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-foreground">{c.name}</span>
                  {c.is_primary && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
                </div>
                {c.title && <div className="text-xs text-muted-foreground">{c.title}</div>}
                <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {c.phone && <span>{c.phone}</span>}
                  {c.email && <span>{c.email}</span>}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => startEdit(c)} className="rounded p-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">Edit</button>
                <button onClick={() => handleDelete(c.id)} className="rounded p-1 hover:bg-muted">
                  <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-500" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
