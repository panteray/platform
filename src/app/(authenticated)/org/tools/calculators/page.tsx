'use client'

import { useRouter } from 'next/navigation'
import { Crosshair, HardDrive, Cable, Ruler, Wrench, Radio, DoorOpen, LayoutGrid, FileCheck, Aperture } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const C = {
  bg: '#0f1117',
  bgPanel: '#171a23',
  border: '#262b38',
  borderHover: '#3b82f6',
  text: '#e4e7ec',
  textMuted: '#8b93a6',
  accent: '#3b82f6',
  accentSubtle: 'rgba(59,130,246,0.08)',
}

const CALCULATORS: { type: string; name: string; description: string; Icon: LucideIcon }[] = [
  { type: 'fov-dori', name: 'FOV / DORI', description: 'Field of view, pixels per foot, DORI classification', Icon: Crosshair },
  { type: 'system-storage', name: 'System / Storage', description: 'Bandwidth, RAID, PoE budget, 5-year TCO', Icon: HardDrive },
  { type: 'wiring-schematic', name: 'Wiring Schematic', description: 'Point-to-point door wiring diagrams', Icon: Cable },
  { type: 'cable-estimator', name: 'Cable Estimator', description: 'Per-run footage, voltage drop, reel count', Icon: Ruler },
  { type: 'mount-calculator', name: 'Mount Calculator', description: 'Compatible mounting hardware', Icon: Wrench },
  { type: 'wireless-ptp', name: 'Wireless PtP', description: 'Link budget, Fresnel zone, rain fade', Icon: Radio },
  { type: 'acs-build', name: 'ACS Build', description: 'Door/lock compliance, electrical load', Icon: DoorOpen },
  { type: 'coverage-area', name: 'Coverage Area', description: 'Camera count + grid layout from room size and DORI target', Icon: LayoutGrid },
  { type: 'lens', name: 'Lens Calculator', description: 'Required focal length from distance + DORI target + sensor', Icon: Aperture },
  { type: 'plan-review', name: 'Plan Review', description: 'NDAA, NEC, IBC, NFPA, ADA, UL compliance check', Icon: FileCheck },
]

export default function CalculatorsPage() {
  const router = useRouter()

  return (
    <div style={{ padding: 24, fontFamily: "'Inter', sans-serif" }}>
      <h1 className="font-display text-2xl font-bold tracking-tight" style={{ color: C.text, marginBottom: 4 }}>Calculators</h1>
      <p className="text-sm" style={{ color: C.textMuted, marginBottom: 24 }}>
        Engineering calculator tools — standalone mode. Also available integrated from the design canvas.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {CALCULATORS.map((calc) => (
          <div key={calc.type}
            onClick={() => router.push(`/org/tools/calculators/${calc.type}`)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              padding: 16, background: C.bgPanel, border: `1px solid ${C.border}`,
              borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.borderHover; e.currentTarget.style.background = C.accentSubtle }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.bgPanel }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: C.accentSubtle, color: C.accent, flexShrink: 0,
            }}>
              <calc.Icon size={18} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 3 }}>{calc.name}</div>
              <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.4 }}>{calc.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
