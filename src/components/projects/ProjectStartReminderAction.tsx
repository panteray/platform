'use client'

import { useState } from 'react'
import { BellRing } from 'lucide-react'
import type { Project } from '@/types/database'

interface Props {
  project: Project
  onUpdate?: (updated: Project) => void
}

/** Manual Project Start Reminder button. Generates the install_reminder
 *  document via the existing documents API, then stamps
 *  start_reminder_sent_at — same pattern as CustomerIntroAction.
 *  The pg_cron job (064) covers the automated 7-days-before path. */
export function ProjectStartReminderAction({ project, onUpdate }: Props) {
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentAt, setSentAt] = useState<string | null>(project.start_reminder_sent_at ?? null)

  async function send() {
    setSending(true); setError(null)

    const docRes = await fetch(`/api/org/projects/${project.id}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc_type: 'install_reminder' }),
    })
    if (!docRes.ok) {
      const err = await docRes.json().catch(() => ({}))
      setError(err.error ?? 'Failed to generate install reminder')
      setSending(false)
      return
    }

    const stampRes = await fetch(`/api/org/projects/${project.id}/start-reminder`, { method: 'POST' })
    const stampResult = await stampRes.json()
    setSending(false)
    if (!stampRes.ok) { setError(stampResult.error ?? 'Failed to record reminder'); return }
    setSentAt(stampResult.start_reminder_sent_at)
    onUpdate?.({ ...project, start_reminder_sent_at: stampResult.start_reminder_sent_at })
  }

  if (sentAt) {
    return (
      <div className="rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
        Project start reminder sent {new Date(sentAt).toLocaleString()}
      </div>
    )
  }

  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 flex items-center gap-3">
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">Project Start Reminder</p>
        <p className="text-xs text-muted-foreground">Generate the install reminder document and mark the reminder sent. Auto-sends 7 days before a hard-booked start.</p>
      </div>
      {error && <span className="text-xs text-red-500">{error}</span>}
      <button
        onClick={send}
        disabled={sending}
        className="inline-flex items-center gap-1.5 h-8 rounded-md bg-amber-600 px-3 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
      >
        <BellRing className="h-3.5 w-3.5" />
        {sending ? 'Sending...' : 'Send Reminder'}
      </button>
    </div>
  )
}
