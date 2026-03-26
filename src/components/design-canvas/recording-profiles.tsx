'use client'

import { useState, useCallback } from 'react'
import { C } from './constants'
import { Section, Field, SliderField, SubLabel } from './section'
import { Plus, Trash2, Copy, ChevronDown, ChevronUp } from 'lucide-react'

export interface RecordingProfile {
  id: string
  name: string
  codec: 'H.264' | 'H.265' | 'H.265+'
  resolution: string
  fps: number
  bitrate: number // Mbps
  recordingMode: 'continuous' | 'motion' | 'motion_object' | 'no_recording'
  retentionDays: number
  smartCodec: boolean
  illumination: 'daylight' | 'low_light' | 'no_light' | 'mixed'
  description: string
}

const PRESET_PROFILES: Omit<RecordingProfile, 'id'>[] = [
  {
    name: 'Indoor Retail',
    codec: 'H.265', resolution: '2MP (1920×1080)', fps: 15, bitrate: 2,
    recordingMode: 'motion_object', retentionDays: 30, smartCodec: true,
    illumination: 'mixed', description: 'Balanced quality for retail spaces with motion+analytics recording',
  },
  {
    name: 'Outdoor Parking',
    codec: 'H.265', resolution: '4MP (2560×1440)', fps: 20, bitrate: 4,
    recordingMode: 'continuous', retentionDays: 30, smartCodec: true,
    illumination: 'mixed', description: 'Higher resolution for license plate and face capture in parking areas',
  },
  {
    name: 'Critical Entry',
    codec: 'H.265', resolution: '4MP (2560×1440)', fps: 30, bitrate: 6,
    recordingMode: 'continuous', retentionDays: 90, smartCodec: false,
    illumination: 'daylight', description: 'Maximum quality for entry points requiring identification-grade footage',
  },
  {
    name: 'Perimeter',
    codec: 'H.265+', resolution: '2MP (1920×1080)', fps: 10, bitrate: 1.5,
    recordingMode: 'motion', retentionDays: 14, smartCodec: true,
    illumination: 'no_light', description: 'Low-bandwidth perimeter monitoring with motion-only recording',
  },
]

interface RecordingProfilesPanelProps {
  profiles: RecordingProfile[]
  onProfilesChange: (profiles: RecordingProfile[]) => void
  assignedProfileId?: string | null
  onAssignProfile?: (profileId: string) => void
}

function generateId(): string {
  return `profile_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/** Estimate bandwidth for a profile */
function estimateBandwidth(profile: RecordingProfile): number {
  return profile.bitrate // Already in Mbps
}

/** Estimate storage per camera for a profile (GB) */
function estimateStorageGb(profile: RecordingProfile): number {
  const hoursPerDay = profile.recordingMode === 'continuous' ? 24 :
    profile.recordingMode === 'motion' ? 8 :
    profile.recordingMode === 'motion_object' ? 6 : 0
  const gbPerHour = (profile.bitrate * 3600) / 8 / 1024 // Mbps → GB/hr
  return Math.round(gbPerHour * hoursPerDay * profile.retentionDays * 10) / 10
}

export function RecordingProfilesPanel({
  profiles, onProfilesChange, assignedProfileId, onAssignProfile,
}: RecordingProfilesPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showPresets, setShowPresets] = useState(false)

  const addProfile = useCallback((preset?: Omit<RecordingProfile, 'id'>) => {
    const newProfile: RecordingProfile = {
      id: generateId(),
      ...(preset || {
        name: `Profile ${profiles.length + 1}`,
        codec: 'H.265', resolution: '2MP (1920×1080)', fps: 15, bitrate: 2,
        recordingMode: 'continuous', retentionDays: 30, smartCodec: true,
        illumination: 'mixed', description: '',
      }),
    }
    onProfilesChange([...profiles, newProfile])
    setExpandedId(newProfile.id)
    setShowPresets(false)
  }, [profiles, onProfilesChange])

  const updateProfile = useCallback((id: string, updates: Partial<RecordingProfile>) => {
    onProfilesChange(profiles.map(p => p.id === id ? { ...p, ...updates } : p))
  }, [profiles, onProfilesChange])

  const deleteProfile = useCallback((id: string) => {
    onProfilesChange(profiles.filter(p => p.id !== id))
    if (expandedId === id) setExpandedId(null)
  }, [profiles, onProfilesChange, expandedId])

  return (
    <div style={{
      background: C.bgPanel, borderRadius: 6,
      border: `1px solid ${C.border}`,
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 10px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: C.text }}>
          Recording Profiles ({profiles.length})
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setShowPresets(!showPresets)}
            style={{
              background: C.bgActive, border: `1px solid ${C.border}`,
              borderRadius: 4, padding: '2px 6px', fontSize: 9,
              color: C.accent, cursor: 'pointer', fontFamily: 'inherit',
              fontWeight: 600,
            }}
          >
            <Plus size={10} style={{ verticalAlign: 'middle' }} /> Preset
          </button>
          <button
            onClick={() => addProfile()}
            style={{
              background: C.accentSubtle, border: `1px solid ${C.accent}`,
              borderRadius: 4, padding: '2px 6px', fontSize: 9,
              color: C.accent, cursor: 'pointer', fontFamily: 'inherit',
              fontWeight: 600,
            }}
          >
            <Plus size={10} style={{ verticalAlign: 'middle' }} /> Custom
          </button>
        </div>
      </div>

      {/* Preset selection dropdown */}
      {showPresets && (
        <div style={{ padding: '6px 10px', borderBottom: `1px solid ${C.border}`, background: C.bgSurface }}>
          <div style={{ fontSize: 9, color: C.textDim, marginBottom: 4 }}>Select a preset:</div>
          {PRESET_PROFILES.map((preset, i) => (
            <div
              key={i}
              onClick={() => addProfile(preset)}
              style={{
                padding: '5px 8px', marginBottom: 3, borderRadius: 4,
                background: C.bgActive, border: `1px solid ${C.borderSubtle}`,
                cursor: 'pointer', transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = C.bgHover}
              onMouseLeave={e => e.currentTarget.style.background = C.bgActive}
            >
              <div style={{ fontSize: 10, fontWeight: 600, color: C.text }}>{preset.name}</div>
              <div style={{ fontSize: 8, color: C.textDim, marginTop: 1 }}>
                {preset.codec} • {preset.fps}fps • {preset.recordingMode.replace(/_/g, ' ')} • {preset.retentionDays}d
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Profile list */}
      {profiles.length === 0 && (
        <div style={{ padding: '16px 10px', textAlign: 'center', fontSize: 10, color: C.textDim }}>
          No profiles defined. Add a preset or custom profile.
        </div>
      )}

      {profiles.map(profile => {
        const isExpanded = expandedId === profile.id
        const isAssigned = assignedProfileId === profile.id
        const storageGb = estimateStorageGb(profile)
        const bw = estimateBandwidth(profile)

        return (
          <div key={profile.id} style={{
            borderBottom: `1px solid ${C.borderSubtle}`,
            background: isAssigned ? C.accentSubtle : 'transparent',
          }}>
            {/* Profile header row */}
            <div
              onClick={() => setExpandedId(isExpanded ? null : profile.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 10px', cursor: 'pointer',
                borderLeft: isAssigned ? `2px solid ${C.accent}` : '2px solid transparent',
              }}
            >
              {isExpanded ? <ChevronUp size={10} color={C.textDim} /> : <ChevronDown size={10} color={C.textDim} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {profile.name}
                </div>
                <div style={{ fontSize: 8, color: C.textDim }}>
                  {profile.codec} • {profile.fps}fps • {bw}Mbps • {storageGb}GB
                </div>
              </div>
              {onAssignProfile && (
                <button
                  onClick={(e) => { e.stopPropagation(); onAssignProfile(profile.id) }}
                  style={{
                    background: isAssigned ? C.accent : C.bgActive,
                    color: isAssigned ? '#fff' : C.textDim,
                    border: `1px solid ${isAssigned ? C.accent : C.border}`,
                    borderRadius: 3, padding: '2px 6px', fontSize: 7,
                    fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {isAssigned ? 'ACTIVE' : 'ASSIGN'}
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); deleteProfile(profile.id) }}
                style={{
                  background: 'none', border: 'none', color: C.textDim,
                  cursor: 'pointer', padding: 2,
                }}
              >
                <Trash2 size={10} />
              </button>
            </div>

            {/* Expanded details */}
            {isExpanded && (
              <div style={{ padding: '6px 10px 10px', borderTop: `1px solid ${C.borderSubtle}` }}>
                <Field label="Codec" value={profile.codec} />
                <Field label="Resolution" value={profile.resolution} />
                <Field label="FPS" value={`${profile.fps}`} />
                <Field label="Bitrate" value={`${profile.bitrate} Mbps`} />
                <Field label="Recording" value={profile.recordingMode.replace(/_/g, ' ')} />
                <Field label="Retention" value={`${profile.retentionDays} days`} />
                <Field label="Smart Codec" value={profile.smartCodec ? 'Enabled' : 'Disabled'} />

                {/* Storage estimate */}
                <div style={{
                  marginTop: 8, padding: '6px 8px', background: C.bgActive,
                  borderRadius: 4, border: `1px solid ${C.borderSubtle}`,
                }}>
                  <div style={{ fontSize: 9, color: C.textDim, marginBottom: 3 }}>Per Camera Estimate</div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace" }}>
                        {bw}
                      </span>
                      <span style={{ fontSize: 8, color: C.textDim }}> Mbps</span>
                    </div>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace" }}>
                        {storageGb}
                      </span>
                      <span style={{ fontSize: 8, color: C.textDim }}> GB</span>
                    </div>
                  </div>
                </div>

                {profile.description && (
                  <div style={{ marginTop: 6, fontSize: 9, color: C.textDim, fontStyle: 'italic' }}>
                    {profile.description}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
