'use client'

import { useState } from 'react'
import { Save, History, Check, Clock, Archive, Send } from 'lucide-react'
import { C } from './constants'

interface QuoteVersion {
  id: string
  version: number
  status: 'draft' | 'submitted' | 'approved' | 'archived'
  mrr: number
  tcv: number
  createdAt: string
  customerNotes: string
}

interface Props {
  versions: QuoteVersion[]
  currentVersion: number
  onSaveVersion: (notes: string) => void
  onLoadVersion: (version: QuoteVersion) => void
  onUpdateStatus: (versionId: string, status: QuoteVersion['status']) => void
}

const STATUS_CONFIG: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  draft: { icon: Clock, color: '#64748b', label: 'Draft' },
  submitted: { icon: Send, color: '#3b82f6', label: 'Submitted' },
  approved: { icon: Check, color: '#22c55e', label: 'Approved' },
  archived: { icon: Archive, color: '#94a3b8', label: 'Archived' },
}

export function QuoteVersionManager({ versions, currentVersion, onSaveVersion, onLoadVersion, onUpdateStatus }: Props) {
  const [saveNotes, setSaveNotes] = useState('')
  const [showSave, setShowSave] = useState(false)

  return (
    <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <History size={14} style={{ color: C.accent }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>Quote Versions</span>
          <span style={{ fontSize: 9, padding: '1px 6px', background: `${C.accent}15`, color: C.accent, borderRadius: 3, fontWeight: 700 }}>V{currentVersion}</span>
        </div>
        <button onClick={() => setShowSave(!showSave)} style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
          background: C.accent, color: '#fff', border: 'none', borderRadius: 4,
          fontSize: 9, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          <Save size={10} /> Save New Version
        </button>
      </div>

      {showSave && (
        <div style={{ marginBottom: 8, padding: 8, background: C.bgActive, borderRadius: 4, border: `1px solid ${C.border}` }}>
          <textarea value={saveNotes} onChange={e => setSaveNotes(e.target.value)} placeholder="Version notes (optional)..." rows={2}
            style={{ width: '100%', padding: '4px 6px', background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 3, color: C.text, fontSize: 10, fontFamily: 'inherit', outline: 'none', resize: 'none' }} />
          <button onClick={() => { onSaveVersion(saveNotes); setSaveNotes(''); setShowSave(false) }}
            style={{ marginTop: 4, padding: '4px 12px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 3, fontSize: 9, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Save V{currentVersion + 1}
          </button>
        </div>
      )}

      {/* Version list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {versions.length === 0 && (
          <div style={{ fontSize: 9, color: C.textDim, fontStyle: 'italic', padding: 8, textAlign: 'center' }}>
            No saved versions yet. Save your first version to start tracking.
          </div>
        )}
        {versions.map(v => {
          const cfg = STATUS_CONFIG[v.status]
          const Icon = cfg.icon
          const isCurrent = v.version === currentVersion
          return (
            <div key={v.id} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px',
              background: isCurrent ? `${C.accent}08` : C.bgPanel,
              border: `1px solid ${isCurrent ? `${C.accent}30` : C.border}`,
              borderRadius: 4, fontSize: 10,
            }}>
              <span style={{ fontWeight: 700, fontFamily: 'monospace', color: C.accent, width: 20 }}>V{v.version}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Icon size={10} style={{ color: cfg.color }} />
                  <span style={{ fontSize: 8, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
                  <span style={{ fontSize: 8, color: C.textDim }}>{new Date(v.createdAt).toLocaleDateString()}</span>
                </div>
                <div style={{ fontSize: 8, color: C.textDim, fontFamily: 'monospace' }}>
                  MRR ${v.mrr.toFixed(0)} · TCV ${v.tcv.toFixed(0)}
                </div>
              </div>
              {!isCurrent && (
                <button onClick={() => onLoadVersion(v)} style={{
                  padding: '2px 6px', fontSize: 8, fontWeight: 600,
                  background: 'transparent', border: `1px solid ${C.border}`,
                  borderRadius: 2, color: C.textMuted, cursor: 'pointer', fontFamily: 'inherit',
                }}>Load</button>
              )}
              <select value={v.status} onChange={e => onUpdateStatus(v.id, e.target.value as QuoteVersion['status'])}
                style={{ padding: '2px 4px', fontSize: 8, background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 2, color: C.text, fontFamily: 'inherit', outline: 'none' }}>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          )
        })}
      </div>
    </div>
  )
}
