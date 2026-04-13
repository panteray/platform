'use client'

import type { SurveyDevice } from '@/types/database'
import { RISK_WEIGHTS } from '@/lib/survey-constants'

interface Props {
  devices: SurveyDevice[]
}

interface RiskScore {
  category: string
  label: string
  score: number
  maxScore: number
  weight: number
}

function computeRisk(devices: SurveyDevice[]): {
  scores: RiskScore[]
  totalWeighted: number
  contingencyPct: number
} {
  // CCTV risk: based on existing vs new ratio + condition
  const cctvDevices = devices.filter(d => d.system_type === 'cctv')
  const cctvExisting = cctvDevices.filter(d => d.status === 'existing_keep' || d.status === 'existing_remove')
  const cctvPoor = cctvDevices.filter(d => d.condition === 'poor')
  const cctvScore = cctvDevices.length === 0 ? 0 : Math.min(10,
    (cctvExisting.length / Math.max(1, cctvDevices.length)) * 5 +
    (cctvPoor.length / Math.max(1, cctvDevices.length)) * 5
  )

  // ACS risk
  const acsDevices = devices.filter(d => d.system_type === 'access_control')
  const acsExisting = acsDevices.filter(d => d.status === 'existing_keep' || d.status === 'existing_remove')
  const acsPoor = acsDevices.filter(d => d.condition === 'poor')
  const acsScore = acsDevices.length === 0 ? 0 : Math.min(10,
    (acsExisting.length / Math.max(1, acsDevices.length)) * 5 +
    (acsPoor.length / Math.max(1, acsDevices.length)) * 5
  )

  // Equipment risk: diversity of vendors/systems
  const uniqueVendors = new Set(devices.filter(d => d.vendor).map(d => d.vendor)).size
  const uniqueSystems = new Set(devices.map(d => d.system_type)).size
  const equipScore = Math.min(10, uniqueVendors * 1.5 + uniqueSystems * 1)

  // Installation risk: cable run lengths, mount complexity
  const longRuns = devices.filter(d => (d.cable_run_ft || 0) > 200).length
  const difficultMounts = devices.filter(d => ['pole', 'parapet', 'gooseneck', 'pendant'].includes(d.mount_type || '')).length
  const installScore = Math.min(10, longRuns * 2 + difficultMounts * 1.5)

  const scores: RiskScore[] = [
    { category: 'cctv', label: 'CCTV', score: Math.round(cctvScore * 10) / 10, maxScore: 10, weight: RISK_WEIGHTS.cctv },
    { category: 'access_control', label: 'Access Control', score: Math.round(acsScore * 10) / 10, maxScore: 10, weight: RISK_WEIGHTS.access_control },
    { category: 'equipment', label: 'Equipment', score: Math.round(equipScore * 10) / 10, maxScore: 10, weight: RISK_WEIGHTS.equipment },
    { category: 'installation', label: 'Installation', score: Math.round(installScore * 10) / 10, maxScore: 10, weight: RISK_WEIGHTS.installation },
  ]

  const totalWeighted = Math.round(
    scores.reduce((sum, s) => sum + s.score * s.weight, 0) * 10
  ) / 10

  // Contingency: 0-2 = 5%, 2-4 = 10%, 4-6 = 15%, 6-8 = 20%, 8+ = 25%
  const contingencyPct = totalWeighted < 2 ? 5
    : totalWeighted < 4 ? 10
    : totalWeighted < 6 ? 15
    : totalWeighted < 8 ? 20
    : 25

  return { scores, totalWeighted, contingencyPct }
}

export function SurveyRiskAssessment({ devices }: Props) {
  const { scores, totalWeighted, contingencyPct } = computeRisk(devices)

  const riskColor = totalWeighted < 3 ? '#22c55e'
    : totalWeighted < 6 ? '#f59e0b'
    : '#ef4444'

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-foreground">Risk Assessment</h4>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">Weighted Score</span>
          <span className="text-sm font-bold" style={{ color: riskColor }}>
            {totalWeighted}/10
          </span>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: riskColor }}>
            {contingencyPct}% contingency
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {scores.map((s) => (
          <div key={s.category}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[11px] text-foreground">{s.label} ({Math.round(s.weight * 100)}%)</span>
              <span className="text-[11px] font-semibold text-foreground">{s.score}/{s.maxScore}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(s.score / s.maxScore) * 100}%`,
                  backgroundColor: s.score < 3 ? '#22c55e' : s.score < 6 ? '#f59e0b' : '#ef4444',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
