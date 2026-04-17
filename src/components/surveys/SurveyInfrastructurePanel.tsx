'use client'

import { useCallback, useRef, useState } from 'react'
import type { SurveyInfrastructure } from '@/types/database'

interface Props {
  surveyId: string
  floorPlanId: string
  floorPlanName: string
  infrastructure: SurveyInfrastructure | null
  onChanged: (item: SurveyInfrastructure) => void
  readOnly?: boolean
}

type InfraField = 'mdf_idf_locations' | 'conduit_pathway' | 'power_availability' | 'network_infrastructure'

/**
 * Per-Area Infrastructure Observations panel.
 *
 * Spec (Section 5): each floor plan/area has its own infrastructure section
 * with four textareas. One DB record per floor plan, auto-created on first edit.
 */
export function SurveyInfrastructurePanel({
  surveyId, floorPlanId, floorPlanName, infrastructure, onChanged, readOnly,
}: Props) {
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const creatingRef = useRef(false)
  const [local, setLocal] = useState<Record<InfraField, string>>({
    mdf_idf_locations: infrastructure?.mdf_idf_locations ?? '',
    conduit_pathway: infrastructure?.conduit_pathway ?? '',
    power_availability: infrastructure?.power_availability ?? '',
    network_infrastructure: infrastructure?.network_infrastructure ?? '',
  })

  const currentIdRef = useRef<string | null>(infrastructure?.id ?? null)
  currentIdRef.current = infrastructure?.id ?? currentIdRef.current

  const persist = useCallback(async (field: InfraField, value: string) => {
    if (currentIdRef.current) {
      const res = await fetch(
        `/api/org/surveys/${surveyId}/infrastructure?infra_id=${currentIdRef.current}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: value || null }),
        }
      )
      if (res.ok) {
        const updated = await res.json()
        onChanged(updated)
      }
      return
    }

    if (creatingRef.current) return
    creatingRef.current = true
    const res = await fetch(`/api/org/surveys/${surveyId}/infrastructure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        floor_plan_id: floorPlanId,
        type: 'other',
        name: floorPlanName,
        [field]: value || null,
      }),
    })
    creatingRef.current = false
    if (res.ok) {
      const created = await res.json()
      currentIdRef.current = created.id
      onChanged(created)
    }
  }, [surveyId, floorPlanId, floorPlanName, onChanged])

  const handleChange = (field: InfraField, value: string) => {
    setLocal(prev => ({ ...prev, [field]: value }))
    if (debounceRef.current[field]) clearTimeout(debounceRef.current[field])
    debounceRef.current[field] = setTimeout(() => persist(field, value), 700)
  }

  const fields: { key: InfraField; label: string; placeholder: string }[] = [
    {
      key: 'mdf_idf_locations',
      label: 'MDF/IDF Locations',
      placeholder: 'e.g. MDF in Room 104, IDF closet Building B hallway',
    },
    {
      key: 'conduit_pathway',
      label: 'Conduit / Pathway Observations',
      placeholder: 'e.g. Existing 1" conduit MDF to IDF. No pathway to gym.',
    },
    {
      key: 'power_availability',
      label: 'Power Availability',
      placeholder: 'e.g. Dedicated 20A circuit in MDF. No power east wall.',
    },
    {
      key: 'network_infrastructure',
      label: 'Network Infrastructure',
      placeholder: 'e.g. 48-port Cisco switch, 12 ports available. Cat5e home runs.',
    },
  ]

  return (
    <div className="space-y-2 p-3">
      {fields.map(({ key, label, placeholder }) => (
        <div key={key}>
          <label className="block text-[11px] font-medium text-muted-foreground mb-0.5">{label}</label>
          <textarea
            value={local[key]}
            onChange={(e) => handleChange(key, e.target.value)}
            disabled={readOnly}
            rows={2}
            placeholder={placeholder}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-[11px] text-foreground outline-none focus:border-primary disabled:opacity-50 resize-none"
          />
        </div>
      ))}
    </div>
  )
}
