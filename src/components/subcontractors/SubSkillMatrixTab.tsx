'use client'

import { useState, useEffect, useCallback } from 'react'
import { Save, Award, MapPin, Wrench } from 'lucide-react'
import type { SubSkillMatrix } from '@/types/database'

interface Props { subId: string }

const TECH_SKILLS = [
  'CCTV Installation', 'Access Control', 'Network Cabling', 'Fiber Splicing',
  'Intrusion Alarm', 'Fire Alarm', 'Intercom Systems', 'AV Systems',
  'Wireless / WiFi', 'Biometrics', 'Door Hardware', 'Gate Operators',
] as const

const SOFT_SKILLS = [
  'Communication', 'Punctuality', 'Documentation', 'Client Relations',
  'Problem Solving', 'Safety Compliance',
] as const

const CERTIFICATIONS = [
  'NICET I', 'NICET II', 'NICET III', 'NICET IV',
  'ESA CFAT', 'BICSI', 'CompTIA Network+', 'OSHA 10', 'OSHA 30',
  'Manufacturer Certified',
] as const

const PRACTICES = ['CCTV', 'ACS', 'INTRUSION', 'FIRE', 'NET', 'AV', 'INTERCOM'] as const

const STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
]

export function SubSkillMatrixTab({ subId }: Props) {
  const [matrix, setMatrix] = useState<SubSkillMatrix | null>(null)
  const [loading, setLoading] = useState(true)
  const [techSkills, setTechSkills] = useState<Record<string, number>>({})
  const [softSkills, setSoftSkills] = useState<Record<string, number>>({})
  const [certs, setCerts] = useState<Record<string, boolean>>({})
  const [territory, setTerritory] = useState<string[]>([])
  const [practices, setPractices] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/org/subs/${subId}/skill-matrix`)
    if (res.ok) {
      const data = await res.json()
      if (data) {
        setMatrix(data)
        setTechSkills(data.technical_skills ?? {})
        setSoftSkills(data.soft_skills ?? {})
        setCerts(data.certifications ?? {})
        setTerritory(data.territory ?? [])
        setPractices(data.approved_practices ?? [])
        setNotes(data.notes ?? '')
      }
    }
    setLoading(false)
  }, [subId])

  useEffect(() => { load() }, [load])

  const save = async () => {
    setSaving(true)
    const res = await fetch(`/api/org/subs/${subId}/skill-matrix`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        technical_skills: techSkills,
        soft_skills: softSkills,
        certifications: certs,
        territory,
        approved_practices: practices,
        notes,
      }),
    })
    if (res.ok) await load()
    setSaving(false)
  }

  const toggleArr = (arr: string[], setter: (v: string[]) => void, val: string) => {
    setter(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val])
  }

  const setRating = (map: Record<string, number>, setter: (m: Record<string, number>) => void, key: string, val: number) => {
    setter({ ...map, [key]: val })
  }

  if (loading) return <div className="flex h-32 items-center justify-center"><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Skill Matrix</h3>
          <p className="text-xs text-muted-foreground">Technical capabilities, certifications, and approved practices</p>
        </div>
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">
          <Save className="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* Technical Skills */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
          <Wrench className="h-3.5 w-3.5" /> Technical Skills
        </h4>
        <div className="space-y-2">
          {TECH_SKILLS.map(skill => (
            <div key={skill} className="flex items-center gap-3">
              <div className="w-40 text-xs font-medium">{skill}</div>
              <div className="flex flex-1 gap-1">
                {[0, 1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setRating(techSkills, setTechSkills, skill, n)}
                    className={`h-7 w-7 rounded text-[10px] font-bold ${(techSkills[skill] ?? 0) === n ? 'bg-primary text-primary-foreground' : 'bg-neutral-100 hover:bg-neutral-200'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-muted-foreground w-20 text-right">
                {(techSkills[skill] ?? 0) === 0 ? 'None' : (techSkills[skill] ?? 0) >= 4 ? 'Expert' : (techSkills[skill] ?? 0) >= 2 ? 'Capable' : 'Novice'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Soft Skills */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h4 className="mb-3 text-xs font-bold uppercase text-muted-foreground">Soft Skills</h4>
        <div className="space-y-2">
          {SOFT_SKILLS.map(skill => (
            <div key={skill} className="flex items-center gap-3">
              <div className="w-40 text-xs font-medium">{skill}</div>
              <div className="flex flex-1 gap-1">
                {[0, 1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setRating(softSkills, setSoftSkills, skill, n)}
                    className={`h-7 w-7 rounded text-[10px] font-bold ${(softSkills[skill] ?? 0) === n ? 'bg-primary text-primary-foreground' : 'bg-neutral-100 hover:bg-neutral-200'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Certifications */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
          <Award className="h-3.5 w-3.5" /> Certifications
        </h4>
        <div className="grid grid-cols-3 gap-2">
          {CERTIFICATIONS.map(c => (
            <label key={c} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={certs[c] ?? false}
                onChange={e => setCerts({ ...certs, [c]: e.target.checked })}
                className="h-3.5 w-3.5 rounded border-neutral-300 text-primary"
              />
              <span className="text-xs">{c}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Approved Practices */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h4 className="mb-3 text-xs font-bold uppercase text-muted-foreground">Approved Practices</h4>
        <div className="flex flex-wrap gap-1.5">
          {PRACTICES.map(p => (
            <button
              key={p}
              onClick={() => toggleArr(practices, setPractices, p)}
              className={`rounded-md px-2.5 py-1 text-xs font-bold ${practices.includes(p) ? 'bg-primary text-primary-foreground' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Territory */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" /> Territory
        </h4>
        <div className="grid grid-cols-10 gap-1">
          {STATES.map(s => (
            <button
              key={s}
              onClick={() => toggleArr(territory, setTerritory, s)}
              className={`rounded py-1.5 text-[10px] font-bold ${territory.includes(s) ? 'bg-primary text-primary-foreground' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
            >
              {s}
            </button>
          ))}
        </div>
        {territory.length > 0 && (
          <p className="mt-2 text-[10px] text-muted-foreground">{territory.length} state{territory.length === 1 ? '' : 's'} selected</p>
        )}
      </div>

      {/* Notes */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h4 className="mb-2 text-xs font-bold uppercase text-muted-foreground">Notes</h4>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Additional capabilities, restrictions, special notes…"
          rows={3}
          className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary resize-none"
        />
      </div>

      {matrix?.updated_at && (
        <p className="text-[10px] text-muted-foreground text-right">Last updated {new Date(matrix.updated_at).toLocaleString()}</p>
      )}
    </div>
  )
}
