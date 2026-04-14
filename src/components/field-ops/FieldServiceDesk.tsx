'use client'

import { useState } from 'react'
import { Headset, Plus, AlertCircle, Clock, CheckCircle2 } from 'lucide-react'

interface Props { projectId: string }

/**
 * Field Service Desk — PSA Ticket View
 *
 * Create/view tickets from field.
 * DB: tickets table (Phase 6). This is the field-side UI shell.
 */

interface MockTicket {
  id: string
  title: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  status: 'open' | 'in_progress' | 'resolved'
  created_at: string
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-neutral-100 text-neutral-600',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
}

export function FieldServiceDesk({ projectId }: Props) {
  const [tickets] = useState<MockTicket[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<string>('MEDIUM')
  const [description, setDescription] = useState('')

  const handleCreate = () => {
    // Phase 6 — will POST to /api/org/tickets
    alert('Ticket creation will be available in Phase 6')
    setShowCreate(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-foreground">Service Desk</h2>
          <p className="text-[10px] text-muted-foreground">Create and track tickets from the field</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          <Plus className="h-3 w-3" /> New Ticket
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Issue title..."
            className="w-full rounded border border-border bg-background px-2.5 py-2 text-xs outline-none focus:border-primary"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={priority}
              onChange={e => setPriority(e.target.value)}
              className="rounded border border-border bg-background px-2 py-1.5 text-xs outline-none"
            >
              <option value="LOW">Low Priority</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe the issue..."
            rows={3}
            className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary resize-none"
          />
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={!title.trim()} className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">Submit</button>
            <button onClick={() => setShowCreate(false)} className="text-xs text-muted-foreground">Cancel</button>
          </div>
        </div>
      )}

      {/* Tickets */}
      {tickets.length === 0 && !showCreate ? (
        <div className="flex flex-col items-center py-8 text-muted-foreground">
          <Headset className="mb-2 h-6 w-6 text-muted-foreground/40" />
          <p className="text-xs">No active tickets</p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">Create a ticket to report field issues</p>
        </div>
      ) : (
        <div className="space-y-1">
          {tickets.map(t => (
            <div key={t.id} className="flex items-center gap-2 rounded-md border border-border px-2.5 py-2">
              {t.status === 'resolved' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
              ) : t.status === 'in_progress' ? (
                <Clock className="h-4 w-4 text-blue-500 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{t.title}</p>
                <p className="text-[10px] text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</p>
              </div>
              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${PRIORITY_COLORS[t.priority]}`}>
                {t.priority}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
