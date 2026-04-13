'use client'

import { useParams } from 'next/navigation'
import { SurveyDetail } from '@/components/surveys/SurveyDetail'

export default function SurveyDetailPage() {
  const params = useParams<{ id: string }>()
  if (!params?.id) return null

  return (
    <div>
      <SurveyDetail
        surveyId={params.id}
        onBack={() => window.history.back()}
      />
    </div>
  )
}
