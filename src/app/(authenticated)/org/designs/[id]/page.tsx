'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useUser } from '@/hooks/useUser'
import { DESIGN_ACCESS_ROLES } from '@/types/enums'
import { DesignCanvas } from '@/components/design-canvas/design-canvas'
import { DesignDashboard } from '@/components/design-canvas/design-dashboard'

type DesignTab = 'dashboard' | 'canvas'

const TAB_STYLE_BASE: React.CSSProperties = {
  padding: '6px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
  border: 'none', borderRadius: '6px 6px 0 0', transition: 'background 0.15s',
}

export default function DesignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { userRole, loading: userLoading } = useUser()
  const [activeTab, setActiveTab] = useState<DesignTab>('dashboard')

  const hasAccess = userRole && (DESIGN_ACCESS_ROLES as readonly string[]).includes(userRole)

  if (userLoading) {
    return (
      <div className="-m-6 h-[calc(100vh-48px)] flex items-center justify-center bg-[#0f1117]">
        <p className="text-sm text-zinc-500">Loading...</p>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="-m-6 h-[calc(100vh-48px)] flex items-center justify-center bg-[#0f1117]">
        <p className="text-sm text-zinc-500">Access denied.</p>
      </div>
    )
  }

  return (
    <div className="-m-6 h-[calc(100vh-48px)] flex flex-col" style={{ background: '#0f1117' }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 2, padding: '0 16px',
        borderBottom: '1px solid #2a2d3a', flexShrink: 0,
      }}>
        <button
          onClick={() => setActiveTab('dashboard')}
          style={{
            ...TAB_STYLE_BASE,
            background: activeTab === 'dashboard' ? '#161922' : 'transparent',
            color: activeTab === 'dashboard' ? '#e4e6eb' : '#5c6078',
            borderBottom: activeTab === 'dashboard' ? '2px solid #3b82f6' : '2px solid transparent',
          }}
        >
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab('canvas')}
          style={{
            ...TAB_STYLE_BASE,
            background: activeTab === 'canvas' ? '#161922' : 'transparent',
            color: activeTab === 'canvas' ? '#e4e6eb' : '#5c6078',
            borderBottom: activeTab === 'canvas' ? '2px solid #3b82f6' : '2px solid transparent',
          }}
        >
          Canvas
        </button>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'dashboard' && (
          <DesignDashboard designId={id} onNavigateCanvas={() => setActiveTab('canvas')} />
        )}
        {activeTab === 'canvas' && (
          <DesignCanvas designId={id} />
        )}
      </div>
    </div>
  )
}
