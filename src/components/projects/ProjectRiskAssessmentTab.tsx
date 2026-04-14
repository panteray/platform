'use client'

import { useState, useEffect, useCallback } from 'react'
import { ShieldAlert, Save, TrendingUp } from 'lucide-react'
import type { RiskAssessment, RiskCategoryScore, RiskCategoryMitigation } from '@/types/database'

interface Props { projectId: string }

const CATEGORIES = ['technical', 'schedule', 'cost', 'scope', 'team'] as const
type Category = typeof CATEGORIES[number]

const CATEGORY_LABELS: Record<Category, string> = {
  technical: 'Technical',
  schedule: 'Schedule',
  cost: 'Cost',
  scope: 'Scope',
  team: 'Team',
}

const STRATEGIES = ['avoid', 'mitigate', 'transfer', 'accept'] as const

const emptyScore = (): RiskCategoryScore => ({ probability: 0, impact: 0, score: 0, notes: '' })
const emptyMit = (): RiskCategoryMitigation => ({ strategy: 'mitigate', action: '', residual: 0 })

const levelColor = (level: string) => {
  if (level === 'critical') return 'bg-red-100 text-red-700 border-red-300'
  if (level === 'high') return 'bg-orange-100 text-orange-700 border-orange-300'
  if (level === 'medium') return 'bg-yellow-100 text-yellow-700 border-yellow-300'
  return 'bg-emerald-100 text-emerald-700 border-emerald-300'
}

const cellColor = (score: number) => {
  if (score >= 17) return 'bg-red-500 text-white'
  if (score >= 10) return 'bg-orange-400 text-white'
  if (score >= 5) return 'bg-yellow-300 text-yellow-900'
  return 'bg-emerald-300 text-emerald-900'
}

export function ProjectRiskAssessmentTab({ projectId }: Props) {
  const [ra, setRa] = useState<RiskAssessment | null>(null)
  const [loading, setLoading] = useState(true)
  const [stage, setStage] = useState<'stage_1' | 'stage_2'>('stage_1')
  const [scores, setScores] = useState<Record<Category, RiskCategoryScore>>({
    technical: emptyScore(), schedule: emptyScore(), cost: emptyScore(), scope: emptyScore(), team: emptyScore(),
  })
  const [mitigations, setMitigations] = useState<Record<Category, RiskCategoryMitigation>>({
    technical: emptyMit(), schedule: emptyMit(), cost: emptyMit(), scope: emptyMit(), team: emptyMit(),
  })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/org/projects/${projectId}/risk-assessment`)
    if (res.ok) {
      const data = await res.json()
      if (data) {
        setRa(data)
        setScores({
          technical: data.technical ?? emptyScore(),
          schedule: data.schedule ?? emptyScore(),
          cost: data.cost ?? emptyScore(),
          scope: data.scope ?? emptyScore(),
          team: data.team ?? emptyScore(),
        })
        setMitigations({
          technical: data.technical_mitigation ?? emptyMit(),
          schedule: data.schedule_mitigation ?? emptyMit(),
          cost: data.cost_mitigation ?? emptyMit(),
          scope: data.scope_mitigation ?? emptyMit(),
          team: data.team_mitigation ?? emptyMit(),
        })
        if (data.status === 'stage_1_complete' || data.status === 'stage_2_complete') setStage('stage_2')
      }
    }
    setLoading(false)
  }, [projectId])

  useEffect(() => { load() }, [load])

  const updateScore = (cat: Category, field: 'probability' | 'impact', val: number) => {
    setScores(prev => {
      const updated = { ...prev[cat], [field]: val }
      updated.score = updated.probability * updated.impact
      return { ...prev, [cat]: updated }
    })
  }

  const updateMit = (cat: Category, field: keyof RiskCategoryMitigation, val: string | number) => {
    setMitigations(prev => ({ ...prev, [cat]: { ...prev[cat], [field]: val } }))
  }

  const totalScore = CATEGORIES.reduce((sum, c) => sum + scores[c].score, 0)
  const residualScore = CATEGORIES.reduce((sum, c) => sum + (mitigations[c].residual ?? scores[c].score), 0)
  const pct = (totalScore / 125) * 100
  const level = pct >= 70 ? 'critical' : pct >= 50 ? 'high' : pct >= 25 ? 'medium' : 'low'

  const save = async () => {
    setSaving(true)
    const body: Record<string, unknown> = {
      status: stage === 'stage_2' ? 'stage_2_complete' : 'stage_1_complete',
    }
    for (const cat of CATEGORIES) {
      body[cat] = scores[cat]
      body[`${cat}_mitigation`] = mitigations[cat]
    }

    const url = ra
      ? `/api/org/projects/${projectId}/risk-assessment?ra_id=${ra.id}`
      : `/api/org/projects/${projectId}/risk-assessment`
    const method = ra ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) await load()
    setSaving(false)
  }

  if (loading) return <div className="flex h-32 items-center justify-center"><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Risk Assessment</h3>
          <p className="text-xs text-muted-foreground">PMI 5×5 matrix &middot; 5 categories &middot; max 125 points</p>
        </div>
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">
          <Save className="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`rounded-lg border-2 p-4 ${levelColor(level)}`}>
          <p className="text-[10px] font-bold uppercase">Overall Risk</p>
          <p className="mt-1 text-3xl font-black">{totalScore}<span className="text-base font-normal opacity-60">/125</span></p>
          <p className="text-xs font-bold uppercase mt-1">{level}</p>
        </div>
        <div className="rounded-lg border-2 border-blue-300 bg-blue-50 p-4 text-blue-700">
          <p className="text-[10px] font-bold uppercase">Residual (after mitigation)</p>
          <p className="mt-1 text-3xl font-black">{residualScore}<span className="text-base font-normal opacity-60">/125</span></p>
          <p className="text-xs font-bold mt-1">
            <TrendingUp className="inline h-3 w-3" /> {totalScore > 0 ? Math.round(((totalScore - residualScore) / totalScore) * 100) : 0}% reduction
          </p>
        </div>
        <div className="rounded-lg border-2 border-neutral-200 bg-neutral-50 p-4 text-neutral-700">
          <p className="text-[10px] font-bold uppercase">Stage</p>
          <div className="mt-1 flex gap-1">
            <button onClick={() => setStage('stage_1')} className={`rounded px-2 py-1 text-xs font-bold ${stage === 'stage_1' ? 'bg-primary text-primary-foreground' : 'bg-white border border-neutral-300'}`}>1: Score</button>
            <button onClick={() => setStage('stage_2')} className={`rounded px-2 py-1 text-xs font-bold ${stage === 'stage_2' ? 'bg-primary text-primary-foreground' : 'bg-white border border-neutral-300'}`}>2: Mitigate</button>
          </div>
          {ra && <p className="text-[10px] mt-2 text-neutral-500">Status: {ra.status.replace(/_/g, ' ')}</p>}
        </div>
      </div>

      {/* Category cards */}
      <div className="space-y-3">
        {CATEGORIES.map(cat => {
          const score = scores[cat]
          const mit = mitigations[cat]
          return (
            <div key={cat} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-primary" />
                  {CATEGORY_LABELS[cat]}
                </h4>
                <div className={`rounded-lg px-3 py-1 text-sm font-black ${cellColor(score.score)}`}>
                  P×I = {score.score}
                </div>
              </div>

              {stage === 'stage_1' ? (
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground mb-1">
                      <span>Probability</span>
                      <span>{score.probability}/5</span>
                    </div>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button key={n} onClick={() => updateScore(cat, 'probability', n)} className={`flex-1 rounded py-2 text-xs font-bold ${score.probability === n ? 'bg-primary text-primary-foreground' : 'bg-neutral-100 hover:bg-neutral-200'}`}>{n}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground mb-1">
                      <span>Impact</span>
                      <span>{score.impact}/5</span>
                    </div>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button key={n} onClick={() => updateScore(cat, 'impact', n)} className={`flex-1 rounded py-2 text-xs font-bold ${score.impact === n ? 'bg-primary text-primary-foreground' : 'bg-neutral-100 hover:bg-neutral-200'}`}>{n}</button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    value={score.notes ?? ''}
                    onChange={e => setScores(prev => ({ ...prev, [cat]: { ...prev[cat], notes: e.target.value } }))}
                    placeholder="Risk description / notes…"
                    rows={2}
                    className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary resize-none"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Strategy</label>
                      <select
                        value={mit.strategy ?? 'mitigate'}
                        onChange={e => updateMit(cat, 'strategy', e.target.value)}
                        className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
                      >
                        {STRATEGIES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Residual Score (0–25)</label>
                      <input
                        type="number"
                        min={0}
                        max={25}
                        value={mit.residual ?? 0}
                        onChange={e => updateMit(cat, 'residual', parseInt(e.target.value) || 0)}
                        className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                  <textarea
                    value={mit.action ?? ''}
                    onChange={e => updateMit(cat, 'action', e.target.value)}
                    placeholder="Mitigation action plan…"
                    rows={2}
                    className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary resize-none"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 5×5 Heat Map */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h4 className="text-xs font-bold mb-3">5×5 Risk Heat Map</h4>
        <div className="inline-block">
          <div className="flex items-center gap-1 mb-1">
            <div className="w-12" />
            {[1, 2, 3, 4, 5].map(p => <div key={p} className="w-10 text-center text-[10px] font-bold text-muted-foreground">{p}</div>)}
          </div>
          {[5, 4, 3, 2, 1].map(impact => (
            <div key={impact} className="flex items-center gap-1 mb-1">
              <div className="w-12 text-right text-[10px] font-bold text-muted-foreground pr-1">I={impact}</div>
              {[1, 2, 3, 4, 5].map(prob => {
                const cellScore = prob * impact
                const dots = CATEGORIES.filter(c => scores[c].probability === prob && scores[c].impact === impact)
                return (
                  <div key={prob} className={`w-10 h-10 rounded flex items-center justify-center text-[9px] font-bold ${cellColor(cellScore)} relative`}>
                    {cellScore}
                    {dots.length > 0 && (
                      <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-white text-[8px] font-black text-neutral-900 flex items-center justify-center border border-neutral-400">
                        {dots.length}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
          <p className="mt-1 text-center text-[10px] text-muted-foreground">Probability →</p>
        </div>
      </div>
    </div>
  )
}
