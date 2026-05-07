'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { SurveyDetail } from '@/components/surveys/SurveyDetail'

export default function SurveyDetailPage() {
  const params = useParams<{ id: string }>()

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  if (!params?.id) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'var(--canvas-bg)',
      display: 'flex', flexDirection: 'column',
    }}>
      <SurveyDetail
        surveyId={params.id}
        onBack={() => window.history.back()}
      />
    </div>
  )
}
