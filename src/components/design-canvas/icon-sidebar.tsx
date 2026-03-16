'use client'

import { C, ICON_TABS, type IconTabId } from './constants'
import { SidebarIcons } from './icons'

interface IconSidebarProps {
  activeIcon: IconTabId
  onIconChange: (id: IconTabId) => void
}

export function IconSidebar({ activeIcon, onIconChange }: IconSidebarProps) {
  return (
    <div
      style={{
        width: 52,
        background: C.bgPanel,
        borderRight: `1px solid ${C.border}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '8px 0',
        gap: 2,
        flexShrink: 0,
      }}
    >
      {ICON_TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onIconChange(tab.id)}
          title={tab.label}
          style={{
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: activeIcon === tab.id ? C.accentSubtle : 'transparent',
            color: activeIcon === tab.id ? C.accent : C.textMuted,
            border: activeIcon === tab.id
              ? '1px solid rgba(59,130,246,0.3)'
              : '1px solid transparent',
            borderRadius: 8,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            if (activeIcon !== tab.id) {
              e.currentTarget.style.background = C.bgHover
              e.currentTarget.style.color = C.text
            }
          }}
          onMouseLeave={(e) => {
            if (activeIcon !== tab.id) {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = C.textMuted
            }
          }}
        >
          {SidebarIcons[tab.id]}
        </button>
      ))}
    </div>
  )
}
