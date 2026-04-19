'use client'

import { useRouter } from 'next/navigation'
import { Crosshair, HardDrive, Cable, Ruler, Wrench, Radio, DoorOpen, LayoutGrid, FileCheck, Aperture } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

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
    <div className="p-6" style={{ fontFamily: "'Inter', sans-serif" }}>
      <h1 className="font-display text-2xl font-bold tracking-tight mb-1 text-slate-900 dark:text-slate-100">Calculators</h1>
      <p className="text-sm mb-6 text-slate-600 dark:text-slate-400">
        Engineering calculator tools — standalone mode. Also available integrated from the design canvas.
      </p>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {CALCULATORS.map((calc) => (
          <div
            key={calc.type}
            onClick={() => router.push(`/org/tools/calculators/${calc.type}`)}
            className="flex items-start gap-3 p-4 rounded-lg cursor-pointer transition-all bg-white dark:bg-[#171a23] border border-slate-200 dark:border-[#262b38] hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10"
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <calc.Icon size={18} />
            </div>
            <div>
              <div className="text-[13px] font-semibold mb-0.5 text-slate-900 dark:text-slate-100">{calc.name}</div>
              <div className="text-[11px] leading-snug text-slate-600 dark:text-slate-400">{calc.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
