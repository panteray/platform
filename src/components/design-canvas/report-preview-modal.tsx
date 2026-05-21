'use client'

import { X, Download, FileText, Loader2 } from 'lucide-react'
import { C } from './constants'
import type { ExportFormat } from '@/lib/export-helpers'

interface ReportPreviewModalProps {
  /** Report name shown in the modal header */
  reportLabel: string
  /** Document title shown above the table */
  title: string
  columns: string[]
  rows: Record<string, unknown>[]
  formats: readonly ExportFormat[]
  loading: boolean
  error: string | null
  /** Format currently being downloaded, or null */
  busy: ExportFormat | null
  onDownload: (fmt: ExportFormat) => void
  onClose: () => void
}

const FORMAT_STYLES: Record<ExportFormat, { bg: string; color: string; border: string }> = {
  xlsm: { bg: 'rgba(34,197,94,0.12)', color: '#16a34a', border: 'rgba(34,197,94,0.3)' },
  xlsx: { bg: `${C.accent}15`, color: C.accent, border: `${C.accent}30` },
  pdf: { bg: 'rgba(239,68,68,0.08)', color: '#ef4444', border: 'rgba(239,68,68,0.2)' },
  docx: { bg: 'rgba(59,130,246,0.08)', color: '#3b82f6', border: 'rgba(59,130,246,0.2)' },
}

function cellText(value: unknown): string {
  if (value == null) return ''
  return String(value)
}

export default function ReportPreviewModal({
  reportLabel, title, columns, rows, formats, loading, error, busy, onDownload, onClose,
}: ReportPreviewModalProps) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div style={{
        width: 880, maxWidth: '94vw', maxHeight: '88vh',
        display: 'flex', flexDirection: 'column',
        background: C.bgPanel, borderRadius: 10, border: `1px solid ${C.border}`,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={16} style={{ color: C.accent }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{reportLabel} — Preview</span>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', padding: 2,
          }}><X size={16} /></button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 18px' }}>
          {loading ? (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '48px 0', color: C.textMuted, fontSize: 12,
            }}>
              <Loader2 size={16} className="animate-spin" />
              Loading report data…
            </div>
          ) : error ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: C.red, fontSize: 12 }}>
              {error}
            </div>
          ) : rows.length === 0 ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: C.textMuted, fontSize: 12 }}>
              No data available for this report.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>{title}</div>
              <div style={{ fontSize: 10, color: C.textDim, marginBottom: 12 }}>
                {rows.length} row{rows.length === 1 ? '' : 's'}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr>
                    {columns.map(col => (
                      <th key={col} style={{
                        position: 'sticky', top: 0, zIndex: 1,
                        textAlign: 'left', padding: '6px 8px',
                        background: C.bgSurface, color: C.textMuted,
                        fontWeight: 700, fontSize: 10, textTransform: 'uppercase',
                        borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
                      }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, ri) => (
                    <tr key={ri} style={{ background: ri % 2 ? 'transparent' : C.bgSurface }}>
                      {columns.map(col => (
                        <td key={col} style={{
                          padding: '5px 8px', color: C.text,
                          borderBottom: `1px solid ${C.borderSubtle}`,
                        }}>{cellText(row[col])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* Footer — download actions */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 18px', borderTop: `1px solid ${C.border}`,
        }}>
          <button onClick={onClose} style={{
            padding: '7px 14px', fontSize: 11, fontWeight: 600,
            background: 'transparent', color: C.textMuted,
            border: `1px solid ${C.border}`, borderRadius: 6,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>Cancel</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, color: C.textDim, marginRight: 2 }}>Download as</span>
            {formats.map(fmt => {
              const fs = FORMAT_STYLES[fmt]
              const disabled = loading || error != null || busy != null
              return (
                <button key={fmt} onClick={() => onDownload(fmt)} disabled={disabled}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '7px 12px', fontSize: 10, fontWeight: 700,
                    background: fs.bg, color: fs.color, border: `1px solid ${fs.border}`,
                    borderRadius: 6, fontFamily: 'inherit', textTransform: 'uppercase',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled && busy !== fmt ? 0.45 : 1,
                  }}>
                  {busy === fmt
                    ? <Loader2 size={11} className="animate-spin" />
                    : <Download size={11} />}
                  {fmt}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
