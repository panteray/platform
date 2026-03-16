'use client'

import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

const CALC_NAMES: Record<string, string> = {
  'fov-dori': 'FOV / DORI Calculator',
  'lpr': 'LPR Calculator',
  'system-storage': 'System / Storage Calculator',
  'solar': 'Solar Calculator',
  'wiring-schematic': 'Wiring Schematic Generator',
  'cable-estimator': 'Cable Estimator',
  'mount-calculator': 'Mount Calculator',
  'wireless-ptp': 'Wireless PtP Calculator',
  'acs-build': 'ACS Build Engine',
}

export default function CalculatorDetailPage() {
  const params = useParams()
  const router = useRouter()
  const calcType = params.type as string
  const calcName = CALC_NAMES[calcType] || 'Calculator'

  return (
    <div style={{ padding: 24 }}>
      <button onClick={() => router.push('/org/tools/calculators')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16 }}>
        <ArrowLeft size={16} /> Back to Calculators
      </button>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>{calcName}</h1>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>Standalone mode — enter values manually. The same engine runs integrated from the design canvas.</p>
      <div style={{ padding: 40, border: '1px solid #e2e8f0', borderRadius: 8, textAlign: 'center', color: '#94a3b8' }}>
        <p style={{ fontSize: 14 }}>Calculator input form for <strong>{calcName}</strong></p>
        <p style={{ fontSize: 12, marginTop: 8 }}>Engine is ported and ready. Input forms will be wired per calculator type.</p>
      </div>
    </div>
  )
}
