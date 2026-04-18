'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, MapPin, Camera, Layers, Trash2, ExternalLink } from 'lucide-react'
import type { Survey } from '@/types/database'

interface Props {
  oppId?: string
  oppNumber?: string
  onSelect: (survey: Survey) => void
  onCreate: () => void
}

export function SurveyList({ oppId, oppNumber, onSelect, onCreate }: Props) {
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const url = oppId
      ? `/api/org/surveys?opp_id=${oppId}`
      : '/api/org/surveys'
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      setSurveys(data)
    }
    setLoading(false)
  }, [oppId])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this draft survey?')) return
    const res = await fetch(`/api/org/surveys/${id}`, { method: 'DELETE' })
    if (res.ok) load()
  }

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {oppId ? 'Surveys' : 'My Surveys'}
          </h3>
          {oppNumber && (
            <p className="text-xs text-muted-foreground">Linked to {oppNumber}</p>
          )}
        </div>
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New Survey
        </button>
      </div>

      {/* Empty State */}
      {surveys.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12">
          <MapPin className="mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No surveys yet</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Create a survey to document site conditions and device placement
          </p>
        </div>
      )}

      {/* Survey Cards */}
      <div className="grid gap-3">
        {surveys.map((survey) => {
          const deviceCount = (survey as unknown as { survey_devices: { count: number }[] }).survey_devices?.[0]?.count ?? 0
          const fpCount = (survey as unknown as { survey_floor_plans: { count: number }[] }).survey_floor_plans?.[0]?.count ?? 0

          return (
            <div
              key={survey.id}
              onClick={() => onSelect(survey)}
              className="group cursor-pointer rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/30 hover:bg-accent/5"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground truncate">
                      {survey.site_name || 'Untitled Survey'}
                    </span>
                  </div>
                  {survey.site_address && (
                    <p className="mt-0.5 text-xs text-muted-foreground truncate">
                      <MapPin className="inline h-3 w-3 mr-0.5" />
                      {survey.site_address}
                    </p>
                  )}
                  <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                    {survey.surveyor_name && <span>{survey.surveyor_name}</span>}
                    {survey.survey_date && <span>{new Date(survey.survey_date).toLocaleDateString()}</span>}
                    <span className="inline-flex items-center gap-0.5">
                      <Camera className="h-3 w-3" /> {deviceCount} devices
                    </span>
                    <span className="inline-flex items-center gap-0.5">
                      <Layers className="h-3 w-3" /> {fpCount} areas
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(survey.id) }}
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
