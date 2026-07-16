'use client'

import { useEffect, useState } from 'react'
import { Send } from 'lucide-react'
import type { Project } from '@/types/database'

interface Props {
  project: Project
}

export function CustomerIntroAction({ project }: Props) {
  const [sentAt, setSentAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!project.opp_id) { setLoading(false); return }
    fetch(`/api/org/opportunities/${project.opp_id}`).then(async (r) => {
      if (r.ok) {
        const opp = await r.json()
        setSentAt(opp.customer_intro_sent_at ?? null)
      }
      setLoading(false)
    })
  }, [project.opp_id])

  async function send() {
    setSending(true); setError(null)

    const docRes = await fetch(`/api/org/projects/${project.id}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc_type: 'welcome_email' }),
    })
    if (!docRes.ok) {
      const err = await docRes.json().catch(() => ({}))
      setError(err.error ?? 'Failed to generate welcome email')
      setSending(false)
      return
    }

    const stampRes = await fetch(`/api/org/projects/${project.id}/customer-intro`, { method: 'POST' })
    const stampResult = await stampRes.json()
    setSending(false)
    if (!stampRes.ok) { setError(stampResult.error ?? 'Failed to record intro'); return }
    setSentAt(stampResult.customer_intro_sent_at)
  }

  if (!project.opp_id) return null
  if (loading) return null

  if (sentAt) {
    return (
      <div className="rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
        Customer introduction sent {new Date(sentAt).toLocaleString()}
      </div>
    )
  }

  return (
    <div className="rounded-md border border-primary/30 bg-primary/5 p-3 flex items-center gap-3">
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">Customer Introduction</p>
        <p className="text-xs text-muted-foreground">Generate the welcome email and mark the customer introduction complete.</p>
      </div>
      {error && <span className="text-xs text-red-500">{error}</span>}
      <button
        onClick={send}
        disabled={sending}
        className="inline-flex items-center gap-1.5 h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        <Send className="h-3.5 w-3.5" />
        {sending ? 'Sending...' : 'Send Introduction'}
      </button>
    </div>
  )
}
