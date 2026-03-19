'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useUser } from '@/hooks/useUser'
import { DESIGN_ACCESS_ROLES } from '@/types/enums'
import { DesignCanvas } from '@/components/design-canvas/design-canvas'
import { DesignDashboard } from '@/components/design-canvas/design-dashboard'

type DesignTab = 'dashboard' | 'canvas'

const TAB_STYLE_BASE: React.CSSProperties = {
  padding: '6px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
  border: 'none', borderRadius: '6px 6px 0 0', transition: 'background 0.15s',
  fontFamily: 'inherit',
}

export default function DesignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { userRole, loading: userLoading } = useUser()
  const [activeTab, setActiveTab] = useState<DesignTab>('dashboard')

  const hasAccess = userRole && (DESIGN_ACCESS_ROLES as readonly string[]).includes(userRole)

  // When canvas is active, prevent body scroll
  useEffect(() => {
    if (activeTab === 'canvas') {
      document.body.style.overflow = 'hidden'
    }
    return () => { document.body.style.overflow = '' }
  }, [activeTab])

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

  // Canvas tab: full-viewport overlay — covers sidebar, topbar, everything
  if (activeTab === 'canvas') {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: '#0f1117',
        display: 'flex', flexDirection: 'column',
      }}>
        <DesignCanvas designId={id} onNavigateDashboard={() => setActiveTab('dashboard')} />
      </div>
    )
  }

  // Dashboard tab: normal app shell layout
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
            background: '#161922',
            color: '#e4e6eb',
            borderBottom: '2px solid #3b82f6',
          }}
        >
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab('canvas')}
          style={{
            ...TAB_STYLE_BASE,
            background: 'transparent',
            color: '#5c6078',
            borderBottom: '2px solid transparent',
          }}
        >
          Canvas
        </button>
      </div>

      {/* Dashboard content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <DesignDashboard designId={id} onNavigateCanvas={() => setActiveTab('canvas')} />
      </div>
    </div>
  )
}
