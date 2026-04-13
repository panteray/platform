'use client'

import { useState, useCallback } from 'react'
import type { Survey } from '@/types/database'
import { SurveyList } from './SurveyList'
import { SurveyDetail } from './SurveyDetail'

interface Props {
  oppId?: string
  oppNumber?: string
}

export function SurveyModule({ oppId, oppNumber }: Props) {
  const [view, setView] = useState<'list' | 'detail'>('list')
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const handleSelect = (survey: Survey) => {
    setSelectedSurveyId(survey.id)
    setView('detail')
  }

  const handleCreate = useCallback(async () => {
    setCreating(true)
    const res = await fetch('/api/org/surveys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        opp_id: oppId || null,
        site_name: '',
      }),
    })
    if (res.ok) {
      const survey = await res.json()
      setSelectedSurveyId(survey.id)
      setView('detail')
    }
    setCreating(false)
  }, [oppId])

  const handleBack = () => {
    setView('list')
    setSelectedSurveyId(null)
  }

  if (view === 'detail' && selectedSurveyId) {
    return <SurveyDetail surveyId={selectedSurveyId} onBack={handleBack} />
  }

  return (
    <SurveyList
      oppId={oppId}
      oppNumber={oppNumber}
      onSelect={handleSelect}
      onCreate={handleCreate}
    />
  )
}
