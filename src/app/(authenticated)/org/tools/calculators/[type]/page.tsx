'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import {
  calculateFovDori, validateFovInput, type FovDoriInput,
  calculateLpr, validateLprInput, type LprInput,
  calculateSystemStorage, type SystemStorageInput,
  calculateSolar, type SolarInput,
  runCableEstimator, type CableEstimatorInput,
  calculateMountRequirements, type MountCalcInput,
  calculateWirelessPtp, type WirelessPtpInput,
  runAcsEngine, type AcsBuildInput,
  generateWiringSchematic, type WiringInput,
} from '@/lib/calculators'

const ic = 'h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500'
const lc = 'block text-[11px] font-medium text-zinc-500 mb-1'
const btnCls = 'h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50'

function NumInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className={lc}>{label}</label>
      <input type="number" className={ic} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}

function ResultBlock({ title, data }: { title: string; data: Record<string, unknown> }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 mt-4">
      <h3 className="text-sm font-semibold text-white mb-3">{title}</h3>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(data).map(([k, v]) => {
          if (v === null || v === undefined || typeof v === 'object') return null
          return (
            <div key={k} className="flex justify-between py-1 border-b border-zinc-900">
              <span className="text-xs text-zinc-500">{k.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1')}</span>
              <span className="text-xs font-medium text-white font-mono">{String(v)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---- Calculator Forms ----

function FovDoriForm() {
  const [f, setF] = useState({ resW: '1920', resH: '1080', sensorW: '5.6', sensorH: '3.15', focal: '4', mountH: '10', targetDist: '30', tilt: '15' })
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  function run() {
    const input: FovDoriInput = { resolutionW: +f.resW, resolutionH: +f.resH, sensorW: +f.sensorW, sensorH: +f.sensorH, focalLength: +f.focal, mountHeight: +f.mountH, targetDistance: +f.targetDist, tiltAngle: +f.tilt }
    const v = validateFovInput(input); if (v.missingFields.length > 0) { alert(`Missing: ${v.missingFields.join(', ')}`); return }
    setResult(calculateFovDori(input) as unknown as Record<string, unknown>)
  }
  return (<div className="space-y-3">
    <div className="grid grid-cols-4 gap-3">
      <NumInput label="Resolution W (px)" value={f.resW} onChange={(v) => setF({ ...f, resW: v })} />
      <NumInput label="Resolution H (px)" value={f.resH} onChange={(v) => setF({ ...f, resH: v })} />
      <NumInput label="Sensor W (mm)" value={f.sensorW} onChange={(v) => setF({ ...f, sensorW: v })} />
      <NumInput label="Sensor H (mm)" value={f.sensorH} onChange={(v) => setF({ ...f, sensorH: v })} />
    </div>
    <div className="grid grid-cols-4 gap-3">
      <NumInput label="Focal Length (mm)" value={f.focal} onChange={(v) => setF({ ...f, focal: v })} />
      <NumInput label="Mount Height (ft)" value={f.mountH} onChange={(v) => setF({ ...f, mountH: v })} />
      <NumInput label="Target Distance (ft)" value={f.targetDist} onChange={(v) => setF({ ...f, targetDist: v })} />
      <NumInput label="Tilt Angle (deg)" value={f.tilt} onChange={(v) => setF({ ...f, tilt: v })} />
    </div>
    <button onClick={run} className={btnCls}>Calculate FOV / DORI</button>
    {result && <ResultBlock title="FOV / DORI Results" data={result} />}
  </div>)
}

function LprForm() {
  const [f, setF] = useState({ resW: '1920', resH: '1080', sensorW: '5.6', focal: '12', mountH: '12', targetDist: '40', speed: '35', lanes: '2' })
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  function run() {
    const input: LprInput = { resolutionW: +f.resW, resolutionH: +f.resH, sensorW: +f.sensorW, focalLength: +f.focal, mountHeight: +f.mountH, targetDistance: +f.targetDist, vehicleSpeedMph: +f.speed, laneCount: +f.lanes }
    setResult(calculateLpr(input) as unknown as Record<string, unknown>)
  }
  return (<div className="space-y-3">
    <div className="grid grid-cols-4 gap-3">
      <NumInput label="Resolution W" value={f.resW} onChange={(v) => setF({ ...f, resW: v })} />
      <NumInput label="Resolution H" value={f.resH} onChange={(v) => setF({ ...f, resH: v })} />
      <NumInput label="Sensor W (mm)" value={f.sensorW} onChange={(v) => setF({ ...f, sensorW: v })} />
      <NumInput label="Focal Length (mm)" value={f.focal} onChange={(v) => setF({ ...f, focal: v })} />
    </div>
    <div className="grid grid-cols-4 gap-3">
      <NumInput label="Mount Height (ft)" value={f.mountH} onChange={(v) => setF({ ...f, mountH: v })} />
      <NumInput label="Target Distance (ft)" value={f.targetDist} onChange={(v) => setF({ ...f, targetDist: v })} />
      <NumInput label="Vehicle Speed (mph)" value={f.speed} onChange={(v) => setF({ ...f, speed: v })} />
      <NumInput label="Lane Count" value={f.lanes} onChange={(v) => setF({ ...f, lanes: v })} />
    </div>
    <button onClick={run} className={btnCls}>Calculate LPR</button>
    {result && <ResultBlock title="LPR Results" data={result} />}
  </div>)
}

function StorageForm() {
  const [f, setF] = useState({ cameras: '16', fps: '15', retention: '30', raidLevel: '5', driveSize: '8' })
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  function run() {
    const cameras = Array.from({ length: +f.cameras }, () => ({
      resolution: '2MP' as const, fps: +f.fps, compression: 'h265' as const, smartCodec: true, motionPercent: 50, poeStandard: 'af' as const, poeWatts: 12.95,
    }))
    const input: SystemStorageInput = { cameras, retentionDays: +f.retention, raidLevel: +f.raidLevel as 5 | 6, driveSizeTB: +f.driveSize }
    setResult(calculateSystemStorage(input) as unknown as Record<string, unknown>)
  }
  return (<div className="space-y-3">
    <div className="grid grid-cols-5 gap-3">
      <NumInput label="Camera Count" value={f.cameras} onChange={(v) => setF({ ...f, cameras: v })} />
      <NumInput label="FPS" value={f.fps} onChange={(v) => setF({ ...f, fps: v })} />
      <NumInput label="Retention (days)" value={f.retention} onChange={(v) => setF({ ...f, retention: v })} />
      <NumInput label="RAID Level" value={f.raidLevel} onChange={(v) => setF({ ...f, raidLevel: v })} />
      <NumInput label="Drive Size (TB)" value={f.driveSize} onChange={(v) => setF({ ...f, driveSize: v })} />
    </div>
    <button onClick={run} className={btnCls}>Calculate Storage</button>
    {result && <ResultBlock title="System / Storage Results" data={result} />}
  </div>)
}

function SolarForm() {
  const [f, setF] = useState({ watts: '25', voltage: '12', days: '3', sunHours: '5' })
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  function run() {
    const input: SolarInput = { cameraWatts: +f.watts, systemVoltage: +f.voltage as 12 | 24, autonomyDays: +f.days, peakSunHours: +f.sunHours }
    setResult(calculateSolar(input) as unknown as Record<string, unknown>)
  }
  return (<div className="space-y-3">
    <div className="grid grid-cols-4 gap-3">
      <NumInput label="Camera Watts" value={f.watts} onChange={(v) => setF({ ...f, watts: v })} />
      <NumInput label="System Voltage (12/24)" value={f.voltage} onChange={(v) => setF({ ...f, voltage: v })} />
      <NumInput label="Autonomy Days" value={f.days} onChange={(v) => setF({ ...f, days: v })} />
      <NumInput label="Peak Sun Hours" value={f.sunHours} onChange={(v) => setF({ ...f, sunHours: v })} />
    </div>
    <button onClick={run} className={btnCls}>Calculate Solar</button>
    {result && <ResultBlock title="Solar Results" data={result} />}
  </div>)
}

function WiringForm() {
  const [f, setF] = useState({ schematicType: 'standard_door', controllerBrand: 'mercury', doorName: 'Door 1', lockType: 'maglock', readerProtocol: 'osdp' })
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  function run() {
    const input = { schematicType: f.schematicType, controllerBrand: f.controllerBrand, controllerModel: '', lockType: f.lockType, lockVendor: '', readerProtocol: f.readerProtocol, hasDps: true, hasRex: true, hasAda: false, operatorModel: '', sequencerModel: '', doorName: f.doorName, mdfIdfLocation: 'MDF' } as WiringInput
    setResult(generateWiringSchematic(input) as unknown as Record<string, unknown>)
  }
  return (<div className="space-y-3">
    <div className="grid grid-cols-3 gap-3">
      <div><label className={lc}>Schematic Type</label><select className={ic} value={f.schematicType} onChange={(e) => setF({ ...f, schematicType: e.target.value })}><option value="standard_door">Standard</option><option value="ada_auto_operator">ADA Auto</option><option value="mantrap">Mantrap</option><option value="mantrap_ada">Mantrap ADA</option></select></div>
      <div><label className={lc}>Controller Brand</label><select className={ic} value={f.controllerBrand} onChange={(e) => setF({ ...f, controllerBrand: e.target.value })}><option value="mercury">Mercury</option><option value="verkada">Verkada</option><option value="brivo">Brivo</option><option value="genetec">Genetec</option><option value="avigilon_alta">Avigilon Alta</option><option value="generic">Generic</option></select></div>
      <NumInput label="Door Name" value={f.doorName} onChange={(v) => setF({ ...f, doorName: v })} />
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div><label className={lc}>Lock Type</label><select className={ic} value={f.lockType} onChange={(e) => setF({ ...f, lockType: e.target.value })}><option value="maglock">Maglock</option><option value="electric_strike">Electric Strike</option><option value="mortise">Mortise</option></select></div>
      <div><label className={lc}>Reader Protocol</label><select className={ic} value={f.readerProtocol} onChange={(e) => setF({ ...f, readerProtocol: e.target.value })}><option value="osdp">OSDP</option><option value="wiegand">Wiegand</option></select></div>
    </div>
    <button onClick={run} className={btnCls}>Generate Wiring Schematic</button>
    {result && <ResultBlock title="Wiring Schematic" data={result} />}
  </div>)
}

function CableForm() {
  const [f, setF] = useState({ horizontal: '150', vertical: '10', slack: '10', serviceLoop: '10', cableType: 'cat6' })
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  function run() {
    const input: CableEstimatorInput = { runs: [{ cableType: f.cableType, horizontalDistanceFt: +f.horizontal, verticalDropFt: +f.vertical, slackPercent: +f.slack, runId: 'run-1', label: 'Run 1', fromDevice: 'Camera', toDevice: 'MDF', mdfIdf: 'MDF-1' }], serviceLoopFt: +f.serviceLoop }
    setResult(runCableEstimator(input) as unknown as Record<string, unknown>)
  }
  return (<div className="space-y-3">
    <div className="grid grid-cols-5 gap-3">
      <NumInput label="Horizontal (ft)" value={f.horizontal} onChange={(v) => setF({ ...f, horizontal: v })} />
      <NumInput label="Vertical (ft)" value={f.vertical} onChange={(v) => setF({ ...f, vertical: v })} />
      <NumInput label="Slack %" value={f.slack} onChange={(v) => setF({ ...f, slack: v })} />
      <NumInput label="Service Loop (ft)" value={f.serviceLoop} onChange={(v) => setF({ ...f, serviceLoop: v })} />
      <div><label className={lc}>Cable Type</label><select className={ic} value={f.cableType} onChange={(e) => setF({ ...f, cableType: e.target.value })}><option value="cat6">Cat6</option><option value="cat5e">Cat5e</option><option value="fiber_sm">Fiber SM</option><option value="fiber_om3">Fiber OM3</option></select></div>
    </div>
    <button onClick={run} className={btnCls}>Estimate Cable</button>
    {result && <ResultBlock title="Cable Estimator Results" data={result} />}
  </div>)
}

function MountForm() {
  const [f, setF] = useState({ formFactor: 'dome', mountType: 'ceiling', weight: '1.2', diameter: '130' })
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  function run() {
    const input: MountCalcInput = { formFactor: f.formFactor, mountType: f.mountType as 'ceiling' | 'wall' | 'pole' | 'pendant', environment: 'indoor', ipRating: 'IP66', weightKg: +f.weight, diameterMm: +f.diameter }
    setResult(calculateMountRequirements(input) as unknown as Record<string, unknown>)
  }
  return (<div className="space-y-3">
    <div className="grid grid-cols-4 gap-3">
      <div><label className={lc}>Form Factor</label><select className={ic} value={f.formFactor} onChange={(e) => setF({ ...f, formFactor: e.target.value })}><option value="dome">Dome</option><option value="bullet">Bullet</option><option value="turret">Turret</option><option value="ptz">PTZ</option><option value="fisheye">Fisheye</option></select></div>
      <div><label className={lc}>Mount Type</label><select className={ic} value={f.mountType} onChange={(e) => setF({ ...f, mountType: e.target.value })}><option value="ceiling">Ceiling</option><option value="wall">Wall</option><option value="pole">Pole</option><option value="pendant">Pendant</option></select></div>
      <NumInput label="Weight (kg)" value={f.weight} onChange={(v) => setF({ ...f, weight: v })} />
      <NumInput label="Diameter (mm)" value={f.diameter} onChange={(v) => setF({ ...f, diameter: v })} />
    </div>
    <button onClick={run} className={btnCls}>Calculate Mounts</button>
    {result && <ResultBlock title="Mount Calculator Results" data={result} />}
  </div>)
}

function WirelessForm() {
  const [f, setF] = useState({ distance: '2', freq: '5.8', txPower: '27', antennaGain: '23', rxSens: '-75', heightA: '30', heightB: '30', cameras: '4', bwPerCam: '8' })
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  function run() {
    const input: WirelessPtpInput = { radioVendor: 'Ubiquiti', radioModel: 'airFiber 5X', mode: 'ptp', distanceMiles: +f.distance, frequencyGHz: +f.freq, txPowerDbm: +f.txPower, antennaGainDbi: +f.antennaGain, rxSensitivityDbm: +f.rxSens, antennaHeightAFt: +f.heightA, antennaHeightBFt: +f.heightB, rainRateMmHr: 25, camerasPerSite: +f.cameras, bandwidthPerCameraMbps: +f.bwPerCam, maxThroughputMbps: 450, windSpeedMph: 30, antennaSurfaceAreaSqFt: 0.15, poeWattsPerCamera: 13, radioWatts: 40 }
    setResult(calculateWirelessPtp(input) as unknown as Record<string, unknown>)
  }
  return (<div className="space-y-3">
    <div className="grid grid-cols-3 gap-3">
      <NumInput label="Distance (miles)" value={f.distance} onChange={(v) => setF({ ...f, distance: v })} />
      <NumInput label="Frequency (GHz)" value={f.freq} onChange={(v) => setF({ ...f, freq: v })} />
      <NumInput label="TX Power (dBm)" value={f.txPower} onChange={(v) => setF({ ...f, txPower: v })} />
    </div>
    <div className="grid grid-cols-3 gap-3">
      <NumInput label="Antenna Gain (dBi)" value={f.antennaGain} onChange={(v) => setF({ ...f, antennaGain: v })} />
      <NumInput label="RX Sensitivity (dBm)" value={f.rxSens} onChange={(v) => setF({ ...f, rxSens: v })} />
      <NumInput label="Cameras/Site" value={f.cameras} onChange={(v) => setF({ ...f, cameras: v })} />
    </div>
    <div className="grid grid-cols-3 gap-3">
      <NumInput label="Height A (ft)" value={f.heightA} onChange={(v) => setF({ ...f, heightA: v })} />
      <NumInput label="Height B (ft)" value={f.heightB} onChange={(v) => setF({ ...f, heightB: v })} />
      <NumInput label="BW/Camera (Mbps)" value={f.bwPerCam} onChange={(v) => setF({ ...f, bwPerCam: v })} />
    </div>
    <button onClick={run} className={btnCls}>Calculate Link Budget</button>
    {result && <ResultBlock title="Wireless PtP Results" data={result} />}
  </div>)
}

function AcsForm() {
  const [f, setF] = useState({ doorType: 'single', lockType: 'maglock', controllerAmps: '0.5', lockAmps: '0.6' })
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  function run() {
    const input: AcsBuildInput = { doorType: f.doorType as AcsBuildInput['doorType'], lockType: f.lockType as AcsBuildInput['lockType'], controllerDrawAmps: +f.controllerAmps, lockDrawAmps: +f.lockAmps, hasAdo: false, isMantrap: f.doorType === 'mantrap' }
    setResult(runAcsEngine(input) as unknown as Record<string, unknown>)
  }
  return (<div className="space-y-3">
    <div className="grid grid-cols-4 gap-3">
      <div><label className={lc}>Door Type</label><select className={ic} value={f.doorType} onChange={(e) => setF({ ...f, doorType: e.target.value })}><option value="single">Single</option><option value="double">Double</option><option value="mantrap">Mantrap</option></select></div>
      <div><label className={lc}>Lock Type</label><select className={ic} value={f.lockType} onChange={(e) => setF({ ...f, lockType: e.target.value })}><option value="maglock">Maglock</option><option value="electric_strike">Electric Strike</option><option value="mortise">Mortise</option></select></div>
      <NumInput label="Controller Amps" value={f.controllerAmps} onChange={(v) => setF({ ...f, controllerAmps: v })} />
      <NumInput label="Lock Amps" value={f.lockAmps} onChange={(v) => setF({ ...f, lockAmps: v })} />
    </div>
    <button onClick={run} className={btnCls}>Run ACS Engine</button>
    {result && <ResultBlock title="ACS Build Results" data={result} />}
  </div>)
}

// ---- Main page ----
const CALC_MAP: Record<string, { name: string; Form: React.FC }> = {
  'fov-dori': { name: 'FOV / DORI Calculator', Form: FovDoriForm },
  'lpr': { name: 'LPR Calculator', Form: LprForm },
  'system-storage': { name: 'System / Storage Calculator', Form: StorageForm },
  'solar': { name: 'Solar Calculator', Form: SolarForm },
  'wiring-schematic': { name: 'Wiring Schematic Generator', Form: WiringForm },
  'cable-estimator': { name: 'Cable Estimator', Form: CableForm },
  'mount-calculator': { name: 'Mount Calculator', Form: MountForm },
  'wireless-ptp': { name: 'Wireless PtP Calculator', Form: WirelessForm },
  'acs-build': { name: 'ACS Build Engine', Form: AcsForm },
}

export default function CalculatorDetailPage() {
  const params = useParams()
  const router = useRouter()
  const calcType = params.type as string
  const calc = CALC_MAP[calcType]
  if (!calc) return <div style={{ padding: 24 }}><p className="text-sm text-zinc-500">Unknown calculator type: {calcType}</p></div>

  return (
    <div style={{ padding: 24 }}>
      <button onClick={() => router.push('/org/tools/calculators')}
        className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 mb-4">
        <ArrowLeft size={16} /> Back to Calculators
      </button>
      <h1 className="text-xl font-semibold text-white mb-1">{calc.name}</h1>
      <p className="text-sm text-zinc-500 mb-6">Standalone mode — enter values manually. Same engine runs integrated from the design canvas.</p>
      <calc.Form />
    </div>
  )
}
