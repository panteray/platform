'use client'

import { useState, useRef } from 'react'
import { C } from './constants'
import { ActionIcons } from './icons'

// ---- Collapsible Section ----

interface SectionProps {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}

export function Section({ title, defaultOpen = false, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div style={{ borderBottom: `1px solid ${C.borderSubtle}` }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '8px 12px', background: 'transparent', border: 'none',
          cursor: 'pointer', color: C.textMuted, fontSize: 10, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: 'inherit',
        }}
      >
        <span>{title}</span>
        {open ? ActionIcons.chevDown : ActionIcons.chevRight}
      </button>
      {open && <div style={{ padding: '0 12px 10px' }}>{children}</div>}
    </div>
  )
}

// ---- Field (read-only or editable) ----

interface FieldProps {
  label: string
  value: string | number
  color?: string
  editable?: boolean
  fieldKey?: string
  onBlurSave?: (key: string, value: string) => void
}

export function Field({ label, value, color, editable, fieldKey, onBlurSave }: FieldProps) {
  const [editing, setEditing] = useState(false)
  const [localVal, setLocalVal] = useState(String(value))
  const inputRef = useRef<HTMLInputElement>(null)

  if (editable && fieldKey) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
        <span style={{ fontSize: 10, color: C.textDim }}>{label}</span>
        {editing ? (
          <input
            ref={inputRef}
            value={localVal}
            onChange={(e) => setLocalVal(e.target.value)}
            onBlur={() => {
              setEditing(false)
              if (localVal !== String(value)) onBlurSave?.(fieldKey, localVal)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setEditing(false)
                if (localVal !== String(value)) onBlurSave?.(fieldKey, localVal)
              }
              if (e.key === 'Escape') { setEditing(false); setLocalVal(String(value)) }
            }}
            autoFocus
            style={{
              width: 80, fontSize: 11, fontWeight: 500, color: C.text,
              fontFamily: "'IBM Plex Mono', monospace", background: C.bgActive,
              border: `1px solid ${C.accent}`, borderRadius: 3, padding: '1px 4px',
              outline: 'none', textAlign: 'right',
            }}
          />
        ) : (
          <span
            onClick={() => { setEditing(true); setLocalVal(String(value)) }}
            style={{
              fontSize: 11, fontWeight: 500, color: color || C.text,
              fontFamily: "'IBM Plex Mono', monospace", cursor: 'pointer',
              borderBottom: `1px dashed ${C.border}`,
            }}
          >
            {value || '\u2014'}
          </span>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
      <span style={{ fontSize: 10, color: C.textDim }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 500, color: color || C.text, fontFamily: "'IBM Plex Mono', monospace" }}>
        {value || '\u2014'}
      </span>
    </div>
  )
}

// ---- Slider Field with drag + onBlur save ----

interface SliderFieldProps {
  label: string
  value: number
  unit: string
  min: number
  max: number
  warning?: boolean
  fieldKey?: string
  onChangeSave?: (key: string, value: number) => void
}

export function SliderField({ label, value, unit, min, max, warning, fieldKey, onChangeSave }: SliderFieldProps) {
  const [localVal, setLocalVal] = useState(value)
  const pct = max > min ? ((localVal - min) / (max - min)) * 100 : 0

  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: C.textDim }}>{label}</span>
        <span style={{
          fontSize: 11, fontWeight: 600,
          color: warning ? C.yellow : C.text,
          fontFamily: "'IBM Plex Mono', monospace",
        }}>
          {localVal} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={localVal}
        onChange={(e) => setLocalVal(Number(e.target.value))}
        onMouseUp={() => {
          if (fieldKey && localVal !== value) onChangeSave?.(fieldKey, localVal)
        }}
        onTouchEnd={() => {
          if (fieldKey && localVal !== value) onChangeSave?.(fieldKey, localVal)
        }}
        style={{
          width: '100%', height: 4, marginTop: 4,
          accentColor: warning ? C.yellow : C.accent,
          cursor: 'pointer',
        }}
      />
      {warning && (
        <div style={{ fontSize: 9, color: C.yellow, marginTop: 3, fontWeight: 600 }}>
          LIFT REQUIRED
        </div>
      )}
    </div>
  )
}

// ---- Sub-section label ----

export function SubLabel({ text }: { text: string }) {
  return (
    <div style={{
      fontSize: 9, color: C.textDim, textTransform: 'uppercase',
      letterSpacing: 0.5, marginBottom: 4,
    }}>
      {text}
    </div>
  )
}
