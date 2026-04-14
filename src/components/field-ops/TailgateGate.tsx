'use client'

import { useState } from 'react'
import { ShieldCheck, CloudSun, Users, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import type { Project } from '@/types/database'

interface Props {
  projectId: string
  project: Project
  onPass: () => void
}

export function TailgateGate({ projectId, project, onPass }: Props) {
  const [weather, setWeather] = useState('')
  const [crewCount, setCrewCount] = useState('')
  const [poConfirmed, setPoConfirmed] = useState(false)
  const [licenseConfirmed, setLicenseConfirmed] = useState(false)
  const [briefing, setBriefing] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)

  const canGenerate = weather.trim() && crewCount && poConfirmed && licenseConfirmed
  const canPass = canGenerate && briefing && acknowledged

  const generateBriefing = async () => {
    setGenerating(true)
    const res = await fetch(`/api/org/projects/${projectId}/ai-briefing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        weather: weather.trim(),
        crew_count: parseInt(crewCount) || 0,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setBriefing(data.briefing)
    } else {
      setBriefing('Failed to generate briefing. Proceed with standard safety protocols.')
    }
    setGenerating(false)
  }

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <div className="text-center">
        <ShieldCheck className="mx-auto h-8 w-8 text-primary mb-2" />
        <h2 className="text-base font-bold text-foreground">Daily Tailgate Briefing</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Complete all items before unlocking field modules
        </p>
      </div>

      {/* Pre-checks */}
      <div className="space-y-2">
        <label className="flex items-center gap-2.5 rounded-lg border border-border p-3 cursor-pointer hover:bg-accent/30 transition-colors">
          <input
            type="checkbox"
            checked={poConfirmed}
            onChange={e => setPoConfirmed(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          <div>
            <p className="text-xs font-medium text-foreground">PO / Work Authorization Confirmed</p>
            <p className="text-[10px] text-muted-foreground">Valid purchase order or authorization exists for this project</p>
          </div>
        </label>

        <label className="flex items-center gap-2.5 rounded-lg border border-border p-3 cursor-pointer hover:bg-accent/30 transition-colors">
          <input
            type="checkbox"
            checked={licenseConfirmed}
            onChange={e => setLicenseConfirmed(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          <div>
            <p className="text-xs font-medium text-foreground">Technician License Verified</p>
            <p className="text-[10px] text-muted-foreground">All crew members hold valid state licenses (where required)</p>
          </div>
        </label>
      </div>

      {/* Weather & Crew */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground mb-1">
            <CloudSun className="h-3 w-3" /> Weather
          </label>
          <input
            value={weather}
            onChange={e => setWeather(e.target.value)}
            placeholder="e.g. Clear, 78°F"
            className="w-full rounded border border-border bg-background px-2.5 py-2 text-xs outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground mb-1">
            <Users className="h-3 w-3" /> Crew Count
          </label>
          <input
            type="number"
            value={crewCount}
            onChange={e => setCrewCount(e.target.value)}
            min={1}
            placeholder="0"
            className="w-full rounded border border-border bg-background px-2.5 py-2 text-xs outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Generate Briefing */}
      {!briefing ? (
        <button
          onClick={generateBriefing}
          disabled={!canGenerate || generating}
          className="w-full rounded-lg bg-primary py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {generating ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating Safety Briefing...</>
          ) : (
            <><ShieldCheck className="h-3.5 w-3.5" /> Generate Safety Briefing</>
          )}
        </button>
      ) : (
        <>
          {/* Briefing Content */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <h3 className="text-[11px] font-bold text-primary mb-1.5 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" /> AI Safety Briefing
            </h3>
            <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{briefing}</p>
          </div>

          {/* Acknowledgment */}
          <label className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={e => setAcknowledged(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
            />
            <div>
              <p className="text-xs font-medium text-foreground flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-amber-600" />
                I have read and acknowledge the safety briefing
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                All crew members have been briefed on today&apos;s safety items
              </p>
            </div>
          </label>

          {/* Pass Gate */}
          <button
            onClick={onPass}
            disabled={!canPass}
            className="w-full rounded-lg bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="h-4 w-4" /> Unlock Field Modules
          </button>
        </>
      )}
    </div>
  )
}
