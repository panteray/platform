'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Phone, Mail, Users, MapPin, FileText, MessageSquare, Linkedin, MoreHorizontal, Trash2, Calendar, Clock } from 'lucide-react'
import { LeadInteractionForm } from './LeadInteractionForm'
import type { LeadInteraction } from '@/types/database'

interface LeadActivityTimelineProps {
  leadId: string
  disabled?: boolean
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  CALL: <Phone className="h-3.5 w-3.5" />,
  EMAIL: <Mail className="h-3.5 w-3.5" />,
  MEETING: <Users className="h-3.5 w-3.5" />,
  SITE_VISIT: <MapPin className="h-3.5 w-3.5" />,
  NOTE: <FileText className="h-3.5 w-3.5" />,
  TEXT: <MessageSquare className="h-3.5 w-3.5" />,
  LINKEDIN: <Linkedin className="h-3.5 w-3.5" />,
  OTHER: <MoreHorizontal className="h-3.5 w-3.5" />,
}

const TYPE_COLORS: Record<string, string> = {
  CALL: '#3b82f6',
  EMAIL: '#8b5cf6',
  MEETING: '#10b981',
  SITE_VISIT: '#f59e0b',
  NOTE: '#6b7280',
  TEXT: '#06b6d4',
  LINKEDIN: '#0077b5',
  OTHER: '#a1a1aa',
}

export function LeadActivityTimeline({ leadId, disabled }: LeadActivityTimelineProps) {
  const [interactions, setInteractions] = useState<LeadInteraction[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const fetchInteractions = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/org/leads/${leadId}/interactions`)
    if (res.ok) {
      const data = await res.json()
      setInteractions(data)
    }
    setLoading(false)
  }, [leadId])

  useEffect(() => {
    fetchInteractions()
  }, [fetchInteractions])

  async function handleDelete(interactionId: string) {
    if (!confirm('Delete this interaction?')) return
    const res = await fetch(`/api/org/leads/${leadId}/interactions?interactionId=${interactionId}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      setInteractions((prev) => prev.filter((i) => i.id !== interactionId))
    }
  }

  function handleSaved() {
    setShowForm(false)
    fetchInteractions()
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Activity Timeline</h3>
        {!disabled && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <Plus className="h-3 w-3" /> Log Interaction
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-4">
          <LeadInteractionForm
            leadId={leadId}
            onSaved={handleSaved}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {loading ? (
        <p className="py-4 text-center text-xs text-muted-foreground">Loading activity...</p>
      ) : interactions.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          No interactions logged yet.{!disabled && ' Click "Log Interaction" to start.'}
        </p>
      ) : (
        <div className="relative space-y-0">
          {/* Timeline line */}
          <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

          {interactions.map((interaction) => {
            const color = TYPE_COLORS[interaction.type] ?? '#a1a1aa'
            const icon = TYPE_ICONS[interaction.type] ?? TYPE_ICONS.OTHER
            const date = new Date(interaction.interaction_date)

            return (
              <div key={interaction.id} className="relative flex gap-3 py-2.5">
                {/* Icon dot */}
                <div
                  className="relative z-10 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${color}18`, color }}
                >
                  {icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                          style={{ backgroundColor: `${color}18`, color }}
                        >
                          {interaction.type.replace(/_/g, ' ')}
                        </span>
                        {interaction.direction && (
                          <span className="text-[10px] text-muted-foreground">
                            {interaction.direction}
                          </span>
                        )}
                      </div>
                      {interaction.subject && (
                        <p className="mt-1 text-sm font-medium text-foreground">{interaction.subject}</p>
                      )}
                      {interaction.body && (
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-3">{interaction.body}</p>
                      )}
                      {interaction.outcome && (
                        <p className="mt-1 text-xs">
                          <span className="font-medium text-muted-foreground">Outcome:</span>{' '}
                          <span className="text-foreground">{interaction.outcome}</span>
                        </p>
                      )}
                      {interaction.follow_up_date && (
                        <div className="mt-1 inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-600">
                          <Calendar className="h-2.5 w-2.5" />
                          Follow-up: {new Date(interaction.follow_up_date).toLocaleDateString()}
                          {interaction.follow_up_note && ` — ${interaction.follow_up_note}`}
                        </div>
                      )}
                    </div>

                    {/* Timestamp + actions */}
                    <div className="flex shrink-0 items-center gap-1">
                      <div className="text-right">
                        <div className="text-[10px] text-muted-foreground">
                          {date.toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <Clock className="h-2.5 w-2.5" />
                          {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {interaction.duration_minutes && ` · ${interaction.duration_minutes}m`}
                        </div>
                      </div>
                      {!disabled && (
                        <div className="relative">
                          <button
                            onClick={() => setMenuOpen(menuOpen === interaction.id ? null : interaction.id)}
                            className="rounded p-1 hover:bg-muted"
                          >
                            <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                          {menuOpen === interaction.id && (
                            <div className="absolute right-0 z-10 mt-1 w-28 rounded-md border border-border bg-card py-1 shadow-md">
                              <button
                                onClick={() => { handleDelete(interaction.id); setMenuOpen(null) }}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-muted"
                              >
                                <Trash2 className="h-3 w-3" /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
