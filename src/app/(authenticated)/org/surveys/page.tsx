'use client'

import { SurveyModule } from '@/components/surveys/SurveyModule'

export default function SurveysPage() {
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-lg font-bold text-foreground">Surveys</h1>
        <p className="text-xs text-muted-foreground">Site surveys for opportunity documentation</p>
      </div>
      <SurveyModule />
    </div>
  )
}
