'use client'

import { useRouter } from 'next/navigation'

const CALCULATORS = [
  { type: 'fov-dori', name: 'FOV / DORI', description: 'Field of view, pixels per foot, DORI classification', icon: '🎯' },
  { type: 'lpr', name: 'LPR', description: 'License plate recognition sizing', icon: '🚗' },
  { type: 'system-storage', name: 'System / Storage', description: 'Bandwidth, RAID, PoE budget, 5-year TCO', icon: '💾' },
  { type: 'solar', name: 'Solar', description: 'Remote camera solar power sizing', icon: '☀️' },
  { type: 'wiring-schematic', name: 'Wiring Schematic', description: 'Point-to-point door wiring diagrams', icon: '🔌' },
  { type: 'cable-estimator', name: 'Cable Estimator', description: 'Per-run footage, voltage drop, reel count', icon: '📏' },
  { type: 'mount-calculator', name: 'Mount Calculator', description: 'Compatible mounting hardware', icon: '🔧' },
  { type: 'wireless-ptp', name: 'Wireless PtP', description: 'Link budget, Fresnel zone, rain fade', icon: '📡' },
  { type: 'acs-build', name: 'ACS Build', description: 'Door/lock compliance, electrical load', icon: '🚪' },
]

export default function CalculatorsPage() {
  const router = useRouter()

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Calculators</h1>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>Engineering calculator tools — standalone mode. Also available integrated from the design canvas.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280, 1fr))', gap: 12 }}>
        {CALCULATORS.map((calc) => (
          <div key={calc.type} onClick={() => router.push(`/org/tools/calculators/${calc.type}`)}
            style={{ padding: 16, border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.background = '#f8fafc' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = 'transparent' }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{calc.name}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{calc.description}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
