'use client'

import { useState, useRef, useCallback } from 'react'
import { Plus, Trash2, Server } from 'lucide-react'
import type { SurveyInfrastructure } from '@/types/database'
import { SURVEY_INFRA_TYPES } from '@/lib/survey-constants'

interface Props {
  surveyId: string
  infrastructure: SurveyInfrastructure[]
  onChanged: (items: SurveyInfrastructure[]) => void
  readOnly?: boolean
}

export function SurveyInfrastructurePanel({ surveyId, infrastructure, onChanged, readOnly }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const handleAdd = async () => {
    const res = await fetch(`/api/org/surveys/${surveyId}/infrastructure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `Infrastructure ${infrastructure.length + 1}`, type: 'mdf' }),
    })
    if (res.ok) {
      const item = await res.json()
      onChanged([...infrastructure, item])
      setExpandedId(item.id)
    }
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/org/surveys/${surveyId}/infrastructure?infra_id=${id}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      onChanged(infrastructure.filter(i => i.id !== id))
      if (expandedId === id) setExpandedId(null)
    }
  }

  const debouncedUpdate = useCallback((infraId: string, field: string, value: string) => {
    const key = `${infraId}_${field}`
    if (debounceRef.current[key]) clearTimeout(debounceRef.current[key])
    debounceRef.current[key] = setTimeout(async () => {
      await fetch(`/api/org/surveys/${surveyId}/infrastructure?infra_id=${infraId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
    }, 800)
  }, [surveyId])

  const handleFieldChange = (infraId: string, field: string, value: string) => {
    onChanged(infrastructure.map(i => i.id === infraId ? { ...i, [field]: value } : i))
    debouncedUpdate(infraId, field, value)
  }

  return (
    <div className="border-t border-border px-3 py-3 space-y-2">
      {infrastructure.map((item) => {
        const typeLabel = SURVEY_INFRA_TYPES.find(t => t.value === item.type)?.label || item.type
        const isExpanded = expandedId === item.id

        return (
          <div key={item.id} className="rounded border border-border">
            <div
              onClick={() => setExpandedId(isExpanded ? null : item.id)}
              className="flex items-center justify-between px-2 py-1.5 cursor-pointer hover:bg-accent/5"
            >
              <div className="flex items-center gap-1.5">
                <Server className="h-3 w-3 text-muted-foreground" />
                <span className="text-[11px] font-semibold text-foreground">{item.name}</span>
                <span className="text-[10px] text-muted-foreground">({typeLabel})</span>
              </div>
              {!readOnly && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(item.id) }}
                  className="rounded p-0.5 text-muted-foreground/40 hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>

            {isExpanded && (
              <div className="border-t border-border px-2 py-2 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">Name</label>
                    <input
                      value={item.name}
                      onChange={(e) => handleFieldChange(item.id, 'name', e.target.value)}
                      disabled={readOnly}
                      className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] outline-none disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">Type</label>
                    <select
                      value={item.type}
                      onChange={(e) => handleFieldChange(item.id, 'type', e.target.value)}
                      disabled={readOnly}
                      className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] outline-none disabled:opacity-50"
                    >
                      {SURVEY_INFRA_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-0.5">Location</label>
                  <input
                    value={item.location || ''}
                    onChange={(e) => handleFieldChange(item.id, 'location', e.target.value)}
                    disabled={readOnly}
                    className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] outline-none disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-0.5">MDF/IDF Locations</label>
                  <textarea
                    value={item.mdf_idf_locations || ''}
                    onChange={(e) => handleFieldChange(item.id, 'mdf_idf_locations', e.target.value)}
                    disabled={readOnly}
                    rows={2}
                    className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] outline-none disabled:opacity-50 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-0.5">Conduit / Pathway</label>
                  <textarea
                    value={item.conduit_pathway || ''}
                    onChange={(e) => handleFieldChange(item.id, 'conduit_pathway', e.target.value)}
                    disabled={readOnly}
                    rows={2}
                    className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] outline-none disabled:opacity-50 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-0.5">Power Availability</label>
                  <textarea
                    value={item.power_availability || ''}
                    onChange={(e) => handleFieldChange(item.id, 'power_availability', e.target.value)}
                    disabled={readOnly}
                    rows={2}
                    className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] outline-none disabled:opacity-50 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-0.5">Network Infrastructure</label>
                  <textarea
                    value={item.network_infrastructure || ''}
                    onChange={(e) => handleFieldChange(item.id, 'network_infrastructure', e.target.value)}
                    disabled={readOnly}
                    rows={2}
                    className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] outline-none disabled:opacity-50 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-0.5">Notes</label>
                  <textarea
                    value={item.notes || ''}
                    onChange={(e) => handleFieldChange(item.id, 'notes', e.target.value)}
                    disabled={readOnly}
                    rows={2}
                    className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] outline-none disabled:opacity-50 resize-none"
                  />
                </div>
              </div>
            )}
          </div>
        )
      })}

      {!readOnly && (
        <button
          onClick={handleAdd}
          className="flex w-full items-center justify-center gap-1 rounded border border-dashed border-border py-2 text-[11px] text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        >
          <Plus className="h-3 w-3" /> Add Infrastructure
        </button>
      )}
    </div>
  )
}
