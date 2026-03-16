'use client'

import { C } from './constants'
import type { DesignDevice } from '@/types/database'

interface LeftPanelProps {
  devices: DesignDevice[]
  selectedId: string | null
  onSelectDevice: (id: string) => void
  onChangeModel?: (deviceId: string) => void
}

export function LeftPanel({ devices, selectedId, onSelectDevice, onChangeModel }: LeftPanelProps) {
  return (
    <div
      style={{
        width: 200,
        background: C.bgPanel,
        borderRight: `1px solid ${C.border}`,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '10px 12px',
          borderBottom: `1px solid ${C.border}`,
          fontSize: 11,
          fontWeight: 600,
          color: C.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
        }}
      >
        On Map ({devices.length})
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
        {devices.length === 0 && (
          <div
            style={{
              padding: '20px 12px',
              textAlign: 'center',
              fontSize: 11,
              color: C.textDim,
            }}
          >
            No devices placed
          </div>
        )}
        {devices.map((d) => {
          const props = (d.properties ?? {}) as Record<string, unknown>
          const channels = (props.channels as number) || 1
          const manufacturer = (props.manufacturer as string) || ''
          const model = (props.model as string) || d.label || 'Unknown'
          const isSelected = selectedId === d.id

          return (
            <div
              key={d.id}
              onClick={() => onSelectDevice(d.id)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                borderBottom: `1px solid ${C.borderSubtle}`,
                background: isSelected ? C.accentSubtle : 'transparent',
                borderLeft: isSelected
                  ? `2px solid ${C.accent}`
                  : '2px solid transparent',
                transition: 'background 0.12s',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.background = C.bgHover
              }}
              onMouseLeave={(e) => {
                if (!isSelected) e.currentTarget.style.background = 'transparent'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>
                  {manufacturer || d.category}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {channels > 1 && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: C.yellow,
                        background: 'rgba(234,179,8,0.12)',
                        padding: '1px 5px',
                        borderRadius: 4,
                      }}
                    >
                      {channels}ch
                    </span>
                  )}
                  {d.color_hex && (
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: d.color_hex,
                      }}
                    />
                  )}
                </div>
              </div>
              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>
                {model}
              </div>
              {onChangeModel && (
                <div
                  onClick={(e) => {
                    e.stopPropagation()
                    onChangeModel(d.id)
                  }}
                  style={{
                    fontSize: 9,
                    color: C.accent,
                    marginTop: 3,
                    opacity: 0.8,
                    cursor: 'pointer',
                  }}
                >
                  Change Model
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
