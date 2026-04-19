'use client'

import { SurveyModule } from '@/components/surveys/SurveyModule'
import { InstallAppButton } from '@/components/layout/InstallAppButton'

export default function SurveysPage() {
  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-foreground">Surveys</h1>
          <p className="text-xs text-muted-foreground">Site surveys for opportunity documentation</p>
        </div>
        <InstallAppButton label="Install for Field Use" />
      </div>
      <SurveyModule />
    </div>
  )
}
