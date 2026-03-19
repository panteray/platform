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

const C = {
  bg: '#0f1117',
  bgPanel: '#171a23',
  bgInput: '#1c2030',
  border: '#262b38',
  text: '#e4e7ec',
  textMuted: '#8b93a6',
  textDim: '#555d72',
  accent: '#3b82f6',
  accentSubtle: 'rgba(59,130,246,0.08)',
  green: '#22c55e',
  red: '#ef4444',
}

const inputStyle: React.CSSProperties = {
  height: 36, width: '100%', borderRadius: 6,
  border: `1px solid ${C.border}`, background: C.bgInput,
  padding: '0 10px', fontSize: 13, color: C.text,
  outline: 'none', fontFamily: "'IBM Plex Mono', monospace",
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 500,
  color: C.textDim, marginBottom: 4, textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const btnStyle: React.CSSProperties = {
  height: 36, borderRadius: 6, background: C.accent,
  padding: '0 16px', fontSize: 13, fontWeight: 600,
  color: '#fff', border: 'none', cursor: 'pointer',
  fontFamily: 'inherit',
}

function NumInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type="number" style={inputStyle} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        onFocus={(e) => { e.currentTarget.style.borderColor = C.accent }}
        onBlur={(e) => { e.currentTarget.style.borderColor = C.border }}
      />
    </div>
  )
}

function SelectInput({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <select style={{ ...inputStyle, appearance: 'none' as const }} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function ResultBlock({ title, data }: { title: string; data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
  if (entries.length === 0) return null

  return (
    <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, background: C.bgPanel, padding: 16, marginTop: 16 }}>
      <h3 style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0 }}>
        {entries.map(([k, v], i) => (
          <div key={k} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 0', borderBottom: i < entries.length - 2 ? `1px solid ${C.border}` : 'none',
          }}>
            <span style={{ fontSize: 11, color: C.textMuted }}>{formatKey(k)}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.text, fontFamily: "'IBM Plex Mono', monospace" }}>{formatValue(v)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatKey(k: string): string {
  return k.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').replace(/^\w/, (c) => c.toUpperCase()).trim()
}

function formatValue(v: unknown): string {
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2)
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v)
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
  return (<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      <NumInput label="Resolution W (px)" value={f.resW} onChange={(v) => setF({ ...f, resW: v })} />
      <NumInput label="Resolution H (px)" value={f.resH} onChange={(v) => setF({ ...f, resH: v })} />
      <NumInput label="Sensor W (mm)" value={f.sensorW} onChange={(v) => setF({ ...f, sensorW: v })} />
      <NumInput label="Sensor H (mm)" value={f.sensorH} onChange={(v) => setF({ ...f, sensorH: v })} />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      <NumInput label="Focal Length (mm)" value={f.focal} onChange={(v) => setF({ ...f, focal: v })} />
      <NumInput label="Mount Height (ft)" value={f.mountH} onChange={(v) => setF({ ...f, mountH: v })} />
      <NumInput label="Target Distance (ft)" value={f.targetDist} onChange={(v) => setF({ ...f, targetDist: v })} />
      <NumInput label="Tilt Angle (deg)" value={f.tilt} onChange={(v) => setF({ ...f, tilt: v })} />
    </div>
    <button onClick={run} style={btnStyle}>Calculate FOV / DORI</button>
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
  return (<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      <NumInput label="Resolution W" value={f.resW} onChange={(v) => setF({ ...f, resW: v })} />
      <NumInput label="Resolution H" value={f.resH} onChange={(v) => setF({ ...f, resH: v })} />
      <NumInput label="Sensor W (mm)" value={f.sensorW} onChange={(v) => setF({ ...f, sensorW: v })} />
      <NumInput label="Focal Length (mm)" value={f.focal} onChange={(v) => setF({ ...f, focal: v })} />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      <NumInput label="Mount Height (ft)" value={f.mountH} onChange={(v) => setF({ ...f, mountH: v })} />
      <NumInput label="Target Distance (ft)" value={f.targetDist} onChange={(v) => setF({ ...f, targetDist: v })} />
      <NumInput label="Vehicle Speed (mph)" value={f.speed} onChange={(v) => setF({ ...f, speed: v })} />
      <NumInput label="Lane Count" value={f.lanes} onChange={(v) => setF({ ...f, lanes: v })} />
    </div>
    <button onClick={run} style={btnStyle}>Calculate LPR</button>
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
  return (<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
      <NumInput label="Camera Count" value={f.cameras} onChange={(v) => setF({ ...f, cameras: v })} />
      <NumInput label="FPS" value={f.fps} onChange={(v) => setF({ ...f, fps: v })} />
      <NumInput label="Retention (days)" value={f.retention} onChange={(v) => setF({ ...f, retention: v })} />
      <NumInput label="RAID Level" value={f.raidLevel} onChange={(v) => setF({ ...f, raidLevel: v })} />
      <NumInput label="Drive Size (TB)" value={f.driveSize} onChange={(v) => setF({ ...f, driveSize: v })} />
    </div>
    <button onClick={run} style={btnStyle}>Calculate Storage</button>
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
  return (<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      <NumInput label="Camera Watts" value={f.watts} onChange={(v) => setF({ ...f, watts: v })} />
      <SelectInput label="System Voltage" value={f.voltage} onChange={(v) => setF({ ...f, voltage: v })} options={[{ value: '12', label: '12V' }, { value: '24', label: '24V' }]} />
      <NumInput label="Autonomy Days" value={f.days} onChange={(v) => setF({ ...f, days: v })} />
      <NumInput label="Peak Sun Hours" value={f.sunHours} onChange={(v) => setF({ ...f, sunHours: v })} />
    </div>
    <button onClick={run} style={btnStyle}>Calculate Solar</button>
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
  return (<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
      <SelectInput label="Schematic Type" value={f.schematicType} onChange={(v) => setF({ ...f, schematicType: v })} options={[{ value: 'standard_door', label: 'Standard' }, { value: 'ada_auto_operator', label: 'ADA Auto' }, { value: 'mantrap', label: 'Mantrap' }, { value: 'mantrap_ada', label: 'Mantrap ADA' }]} />
      <SelectInput label="Controller Brand" value={f.controllerBrand} onChange={(v) => setF({ ...f, controllerBrand: v })} options={[{ value: 'mercury', label: 'Mercury' }, { value: 'verkada', label: 'Verkada' }, { value: 'brivo', label: 'Brivo' }, { value: 'genetec', label: 'Genetec' }, { value: 'avigilon_alta', label: 'Avigilon Alta' }, { value: 'generic', label: 'Generic' }]} />
      <NumInput label="Door Name" value={f.doorName} onChange={(v) => setF({ ...f, doorName: v })} />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
      <SelectInput label="Lock Type" value={f.lockType} onChange={(v) => setF({ ...f, lockType: v })} options={[{ value: 'maglock', label: 'Maglock' }, { value: 'electric_strike', label: 'Electric Strike' }, { value: 'mortise', label: 'Mortise' }]} />
      <SelectInput label="Reader Protocol" value={f.readerProtocol} onChange={(v) => setF({ ...f, readerProtocol: v })} options={[{ value: 'osdp', label: 'OSDP' }, { value: 'wiegand', label: 'Wiegand' }]} />
    </div>
    <button onClick={run} style={btnStyle}>Generate Wiring Schematic</button>
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
  return (<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
      <NumInput label="Horizontal (ft)" value={f.horizontal} onChange={(v) => setF({ ...f, horizontal: v })} />
      <NumInput label="Vertical (ft)" value={f.vertical} onChange={(v) => setF({ ...f, vertical: v })} />
      <NumInput label="Slack %" value={f.slack} onChange={(v) => setF({ ...f, slack: v })} />
      <NumInput label="Service Loop (ft)" value={f.serviceLoop} onChange={(v) => setF({ ...f, serviceLoop: v })} />
      <SelectInput label="Cable Type" value={f.cableType} onChange={(v) => setF({ ...f, cableType: v })} options={[{ value: 'cat6', label: 'Cat6' }, { value: 'cat5e', label: 'Cat5e' }, { value: 'fiber_sm', label: 'Fiber SM' }, { value: 'fiber_om3', label: 'Fiber OM3' }]} />
    </div>
    <button onClick={run} style={btnStyle}>Estimate Cable</button>
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
  return (<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      <SelectInput label="Form Factor" value={f.formFactor} onChange={(v) => setF({ ...f, formFactor: v })} options={[{ value: 'dome', label: 'Dome' }, { value: 'bullet', label: 'Bullet' }, { value: 'turret', label: 'Turret' }, { value: 'ptz', label: 'PTZ' }, { value: 'fisheye', label: 'Fisheye' }]} />
      <SelectInput label="Mount Type" value={f.mountType} onChange={(v) => setF({ ...f, mountType: v })} options={[{ value: 'ceiling', label: 'Ceiling' }, { value: 'wall', label: 'Wall' }, { value: 'pole', label: 'Pole' }, { value: 'pendant', label: 'Pendant' }]} />
      <NumInput label="Weight (kg)" value={f.weight} onChange={(v) => setF({ ...f, weight: v })} />
      <NumInput label="Diameter (mm)" value={f.diameter} onChange={(v) => setF({ ...f, diameter: v })} />
    </div>
    <button onClick={run} style={btnStyle}>Calculate Mounts</button>
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
  return (<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
      <NumInput label="Distance (miles)" value={f.distance} onChange={(v) => setF({ ...f, distance: v })} />
      <NumInput label="Frequency (GHz)" value={f.freq} onChange={(v) => setF({ ...f, freq: v })} />
      <NumInput label="TX Power (dBm)" value={f.txPower} onChange={(v) => setF({ ...f, txPower: v })} />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
      <NumInput label="Antenna Gain (dBi)" value={f.antennaGain} onChange={(v) => setF({ ...f, antennaGain: v })} />
      <NumInput label="RX Sensitivity (dBm)" value={f.rxSens} onChange={(v) => setF({ ...f, rxSens: v })} />
      <NumInput label="Cameras/Site" value={f.cameras} onChange={(v) => setF({ ...f, cameras: v })} />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
      <NumInput label="Height A (ft)" value={f.heightA} onChange={(v) => setF({ ...f, heightA: v })} />
      <NumInput label="Height B (ft)" value={f.heightB} onChange={(v) => setF({ ...f, heightB: v })} />
      <NumInput label="BW/Camera (Mbps)" value={f.bwPerCam} onChange={(v) => setF({ ...f, bwPerCam: v })} />
    </div>
    <button onClick={run} style={btnStyle}>Calculate Link Budget</button>
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
  return (<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      <SelectInput label="Door Type" value={f.doorType} onChange={(v) => setF({ ...f, doorType: v })} options={[{ value: 'single', label: 'Single' }, { value: 'double', label: 'Double' }, { value: 'mantrap', label: 'Mantrap' }]} />
      <SelectInput label="Lock Type" value={f.lockType} onChange={(v) => setF({ ...f, lockType: v })} options={[{ value: 'maglock', label: 'Maglock' }, { value: 'electric_strike', label: 'Electric Strike' }, { value: 'mortise', label: 'Mortise' }]} />
      <NumInput label="Controller Amps" value={f.controllerAmps} onChange={(v) => setF({ ...f, controllerAmps: v })} />
      <NumInput label="Lock Amps" value={f.lockAmps} onChange={(v) => setF({ ...f, lockAmps: v })} />
    </div>
    <button onClick={run} style={btnStyle}>Run ACS Engine</button>
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

  if (!calc) return (
    <div style={{ padding: 24 }}>
      <p style={{ fontSize: 13, color: C.textMuted }}>Unknown calculator type: {calcType}</p>
    </div>
  )

  return (
    <div style={{ padding: 24, fontFamily: "'Inter', sans-serif", maxWidth: 960 }}>
      <button onClick={() => router.push('/org/tools/calculators')}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: C.accent, background: 'none', border: 'none',
          cursor: 'pointer', marginBottom: 16, padding: 0, fontFamily: 'inherit',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = '#60a5fa' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = C.accent }}
      >
        <ArrowLeft size={14} /> Back to Calculators
      </button>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 4 }}>{calc.name}</h1>
      <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 24 }}>
        Standalone mode — enter values manually. Same engine runs integrated from the design canvas.
      </p>
      <calc.Form />
    </div>
  )
}
