'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import {
  calculateFovDori, validateFovInput, type FovDoriInput,
  calculateSystemStorage, type SystemStorageInput,
  runCableEstimator, type CableEstimatorInput,
  calculateMountRequirements, type MountCalcInput,
  calculateWirelessPtp, type WirelessPtpInput,
  runAcsEngine, type AcsBuildInput,
  generateWiringSchematic, type WiringInput,
  loadMountCatalog, listModelsForVendor, MOUNT_CATALOG_VENDORS,
  type MountCatalog, type VendorMountPart,
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
  yellow: '#eab308',
}

// --- IPVM pattern: glow-on-change input ---
function CalcInput({ label, value, onChange, placeholder, error, glowing }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; error?: string; glowing?: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [glow, setGlow] = useState(false)

  useEffect(() => {
    if (glowing) {
      setGlow(true)
      const t = setTimeout(() => setGlow(false), 1600)
      return () => clearTimeout(t)
    }
  }, [glowing])

  return (
    <div>
      <label style={{
        display: 'block', fontSize: 10, fontWeight: 500,
        color: error ? C.red : C.textDim, marginBottom: 4,
        textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>{label}</label>
      <input
        ref={ref}
        type="tel"
        inputMode="decimal"
        style={{
          height: 36, width: '100%', borderRadius: 6,
          border: `1px solid ${error ? C.red : glow ? C.accent : C.border}`,
          background: C.bgInput,
          padding: '0 10px', fontSize: 13, color: C.text,
          outline: 'none', fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace",
          boxShadow: glow ? `0 0 0 3px ${C.accent}30` : 'none',
          transition: 'border-color 0.3s, box-shadow 0.5s',
        }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={(e) => { if (!error) e.currentTarget.style.borderColor = C.accent }}
        onBlur={(e) => { if (!error && !glow) e.currentTarget.style.borderColor = C.border }}
      />
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 3 }}>
          <AlertCircle size={10} color={C.red} />
          <span style={{ fontSize: 10, color: C.red }}>{error}</span>
        </div>
      )}
    </div>
  )
}

function SelectInput({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]
}) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: 10, fontWeight: 500,
        color: C.textDim, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>{label}</label>
      <select style={{
        height: 36, width: '100%', borderRadius: 6,
        border: `1px solid ${C.border}`, background: C.bgInput,
        padding: '0 10px', fontSize: 13, color: C.text,
        outline: 'none', fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace",
        appearance: 'none' as const,
      }} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

// --- Result card: primary metric large, secondary in grid ---
function ResultCard({ title, primary, data }: {
  title: string; primary?: { label: string; value: string | number; unit?: string }; data: Record<string, unknown>
}) {
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
  if (entries.length === 0 && !primary) return null

  return (
    <div style={{
      borderRadius: 8, border: `1px solid ${C.border}`, background: C.bgPanel,
      padding: 16, marginTop: 16,
      animation: 'fadeIn 0.3s ease',
    }}>
      <h3 style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: primary ? 8 : 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</h3>

      {/* Primary metric — hero display */}
      {primary && (
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 6,
          padding: '12px 0', marginBottom: 12,
          borderBottom: `1px solid ${C.border}`,
        }}>
          <span style={{ fontSize: 28, fontWeight: 700, color: C.accent, fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace" }}>
            {primary.value}
          </span>
          {primary.unit && <span style={{ fontSize: 13, color: C.textMuted }}>{primary.unit}</span>}
          <span style={{ fontSize: 11, color: C.textDim, marginLeft: 4 }}>{primary.label}</span>
        </div>
      )}

      {/* Secondary metrics grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0 }}>
        {entries.map(([k, v], i) => (
          <div key={k} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 0', borderBottom: i < entries.length - 2 ? `1px solid ${C.border}` : 'none',
          }}>
            <span style={{ fontSize: 11, color: C.textMuted }}>{formatKey(k)}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.text, fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace" }}>
              {formatValue(v)}
            </span>
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

// --- Auto-run hook: debounced calculation on input change ---
function useAutoCalc<T>(fn: () => T | null, deps: unknown[], delay = 300) {
  const [result, setResult] = useState<T | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Dynamic deps array passed at call site — ESLint cannot statically analyze spread deps
  const compute = useCallback(fn, deps) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      try {
        setResult(compute())
      } catch {
        setResult(null)
      }
    }, delay)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [compute, delay])

  return result
}

// ---- Calculator Forms with auto-calc + inline validation ----

function FovDoriForm() {
  const [f, setF] = useState({ resW: '1920', resH: '1080', sensorW: '5.6', sensorH: '3.15', focal: '4', mountH: '10', targetDist: '30', tilt: '15' })
  const result = useAutoCalc(() => {
    const input: FovDoriInput = { resolutionW: +f.resW, resolutionH: +f.resH, sensorW: +f.sensorW, sensorH: +f.sensorH, focalLength: +f.focal, mountHeight: +f.mountH, targetDistance: +f.targetDist, tiltAngle: +f.tilt }
    const v = validateFovInput(input)
    if (v.missingFields.length > 0) return null
    return calculateFovDori(input) as unknown as Record<string, unknown>
  }, [f])
  const primary = result ? { label: 'Horizontal FOV', value: formatValue(result.hFov), unit: 'deg' } : undefined
  return (<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      <CalcInput label="Resolution W (px)" value={f.resW} onChange={(v) => setF({ ...f, resW: v })} error={+f.resW <= 0 ? 'Required' : undefined} />
      <CalcInput label="Resolution H (px)" value={f.resH} onChange={(v) => setF({ ...f, resH: v })} error={+f.resH <= 0 ? 'Required' : undefined} />
      <CalcInput label="Sensor W (mm)" value={f.sensorW} onChange={(v) => setF({ ...f, sensorW: v })} error={+f.sensorW <= 0 ? 'Required' : undefined} />
      <CalcInput label="Sensor H (mm)" value={f.sensorH} onChange={(v) => setF({ ...f, sensorH: v })} />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      <CalcInput label="Focal Length (mm)" value={f.focal} onChange={(v) => setF({ ...f, focal: v })} error={+f.focal <= 0 ? 'Required' : undefined} />
      <CalcInput label="Mount Height (ft)" value={f.mountH} onChange={(v) => setF({ ...f, mountH: v })} />
      <CalcInput label="Target Distance (ft)" value={f.targetDist} onChange={(v) => setF({ ...f, targetDist: v })} />
      <CalcInput label="Tilt Angle (deg)" value={f.tilt} onChange={(v) => setF({ ...f, tilt: v })} />
    </div>
    {result && <ResultCard title="FOV / DORI Results" primary={primary} data={result} />}
  </div>)
}

function StorageForm() {
  const [f, setF] = useState({ cameras: '16', fps: '15', retention: '30', raidLevel: '5', driveSize: '8' })
  const result = useAutoCalc(() => {
    const cameras = Array.from({ length: +f.cameras }, () => ({
      resolution: '2MP' as const, fps: +f.fps, compression: 'h265' as const, smartCodec: true, motionPercent: 50, poeStandard: 'af' as const, poeWatts: 12.95,
    }))
    const input: SystemStorageInput = { cameras, retentionDays: +f.retention, raidLevel: +f.raidLevel as 5 | 6, driveSizeTB: +f.driveSize }
    return calculateSystemStorage(input) as unknown as Record<string, unknown>
  }, [f])
  const primary = result ? { label: 'Total Storage', value: formatValue(result.totalStorageTB), unit: 'TB' } : undefined
  return (<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
      <CalcInput label="Camera Count" value={f.cameras} onChange={(v) => setF({ ...f, cameras: v })} error={+f.cameras <= 0 ? 'Min 1' : undefined} />
      <CalcInput label="FPS" value={f.fps} onChange={(v) => setF({ ...f, fps: v })} />
      <CalcInput label="Retention (days)" value={f.retention} onChange={(v) => setF({ ...f, retention: v })} />
      <CalcInput label="RAID Level" value={f.raidLevel} onChange={(v) => setF({ ...f, raidLevel: v })} />
      <CalcInput label="Drive Size (TB)" value={f.driveSize} onChange={(v) => setF({ ...f, driveSize: v })} />
    </div>
    {result && <ResultCard title="System / Storage Results" primary={primary} data={result} />}
  </div>)
}

function WiringForm() {
  const [f, setF] = useState({ schematicType: 'standard_door', controllerBrand: 'mercury', doorName: 'Door 1', lockType: 'maglock', readerProtocol: 'osdp' })
  const result = useAutoCalc(() => {
    const input = { schematicType: f.schematicType, controllerBrand: f.controllerBrand, controllerModel: '', lockType: f.lockType, lockVendor: '', readerProtocol: f.readerProtocol, hasDps: true, hasRex: true, hasAda: false, operatorModel: '', sequencerModel: '', doorName: f.doorName, mdfIdfLocation: 'MDF' } as WiringInput
    return generateWiringSchematic(input) as unknown as Record<string, unknown>
  }, [f])
  return (<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
      <SelectInput label="Schematic Type" value={f.schematicType} onChange={(v) => setF({ ...f, schematicType: v })} options={[{ value: 'standard_door', label: 'Standard' }, { value: 'ada_auto_operator', label: 'ADA Auto' }, { value: 'mantrap', label: 'Mantrap' }, { value: 'mantrap_ada', label: 'Mantrap ADA' }]} />
      <SelectInput label="Controller Brand" value={f.controllerBrand} onChange={(v) => setF({ ...f, controllerBrand: v })} options={[{ value: 'mercury', label: 'Mercury' }, { value: 'verkada', label: 'Verkada' }, { value: 'brivo', label: 'Brivo' }, { value: 'genetec', label: 'Genetec' }, { value: 'avigilon_alta', label: 'Avigilon Alta' }, { value: 'generic', label: 'Generic' }]} />
      <CalcInput label="Door Name" value={f.doorName} onChange={(v) => setF({ ...f, doorName: v })} />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
      <SelectInput label="Lock Type" value={f.lockType} onChange={(v) => setF({ ...f, lockType: v })} options={[{ value: 'maglock', label: 'Maglock' }, { value: 'electric_strike', label: 'Electric Strike' }, { value: 'mortise', label: 'Mortise' }]} />
      <SelectInput label="Reader Protocol" value={f.readerProtocol} onChange={(v) => setF({ ...f, readerProtocol: v })} options={[{ value: 'osdp', label: 'OSDP' }, { value: 'wiegand', label: 'Wiegand' }]} />
    </div>
    {result && <ResultCard title="Wiring Schematic" primary={undefined} data={result} />}
  </div>)
}

function CableForm() {
  const [f, setF] = useState({ horizontal: '150', vertical: '10', slack: '10', serviceLoop: '10', cableType: 'cat6' })
  const result = useAutoCalc(() => {
    const input: CableEstimatorInput = { runs: [{ cableType: f.cableType, horizontalDistanceFt: +f.horizontal, verticalDropFt: +f.vertical, slackPercent: +f.slack, runId: 'run-1', label: 'Run 1', fromDevice: 'Camera', toDevice: 'MDF', mdfIdf: 'MDF-1' }], serviceLoopFt: +f.serviceLoop }
    return runCableEstimator(input) as unknown as Record<string, unknown>
  }, [f])
  return (<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
      <CalcInput label="Horizontal (ft)" value={f.horizontal} onChange={(v) => setF({ ...f, horizontal: v })} />
      <CalcInput label="Vertical (ft)" value={f.vertical} onChange={(v) => setF({ ...f, vertical: v })} />
      <CalcInput label="Slack %" value={f.slack} onChange={(v) => setF({ ...f, slack: v })} />
      <CalcInput label="Service Loop (ft)" value={f.serviceLoop} onChange={(v) => setF({ ...f, serviceLoop: v })} />
      <SelectInput label="Cable Type" value={f.cableType} onChange={(v) => setF({ ...f, cableType: v })} options={[{ value: 'cat6', label: 'Cat6' }, { value: 'cat5e', label: 'Cat5e' }, { value: 'fiber_sm', label: 'Fiber SM' }, { value: 'fiber_om3', label: 'Fiber OM3' }]} />
    </div>
    {result && <ResultCard title="Cable Estimator Results" primary={undefined} data={result} />}
  </div>)
}

function MountForm() {
  const [f, setF] = useState({ formFactor: 'dome', mountType: 'ceiling', weight: '1.2', diameter: '130', vendor: 'Hanwha', model: '' })
  const [catalog, setCatalog] = useState<MountCatalog | null>(null)

  useEffect(() => {
    loadMountCatalog().then(setCatalog).catch(() => setCatalog({}))
  }, [])

  const models = catalog ? listModelsForVendor(catalog, f.vendor) : []

  const result = useAutoCalc(() => {
    const input: MountCalcInput = {
      formFactor: f.formFactor,
      mountType: f.mountType as 'ceiling' | 'wall' | 'pole' | 'pendant',
      environment: 'indoor',
      ipRating: 'IP66',
      weightKg: +f.weight,
      diameterMm: +f.diameter,
      vendor: f.vendor || undefined,
      model: f.model || undefined,
    }
    return calculateMountRequirements(input, 0, catalog) as unknown as Record<string, unknown>
  }, [f, catalog])

  const vendorParts = (result?.vendorParts as VendorMountPart[] | undefined) ?? []
  const heightGuidance = (result?.heightGuidance as string | null | undefined) ?? null

  return (<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      <SelectInput label="Form Factor" value={f.formFactor} onChange={(v) => setF({ ...f, formFactor: v })} options={[{ value: 'dome', label: 'Dome' }, { value: 'bullet', label: 'Bullet' }, { value: 'turret', label: 'Turret' }, { value: 'ptz', label: 'PTZ' }, { value: 'fisheye', label: 'Fisheye' }]} />
      <SelectInput label="Mount Type" value={f.mountType} onChange={(v) => setF({ ...f, mountType: v })} options={[{ value: 'ceiling', label: 'Ceiling' }, { value: 'wall', label: 'Wall' }, { value: 'pole', label: 'Pole' }, { value: 'pendant', label: 'Pendant' }]} />
      <CalcInput label="Weight (kg)" value={f.weight} onChange={(v) => setF({ ...f, weight: v })} />
      <CalcInput label="Diameter (mm)" value={f.diameter} onChange={(v) => setF({ ...f, diameter: v })} />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
      <SelectInput label="Vendor (Catalog)" value={f.vendor} onChange={(v) => setF({ ...f, vendor: v, model: '' })} options={MOUNT_CATALOG_VENDORS.map(v => ({ value: v, label: v }))} />
      <div>
        <label style={{ display: 'block', fontSize: 10, fontWeight: 500, color: C.textDim, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Model</label>
        <input
          list="mount-models"
          type="text"
          value={f.model}
          onChange={(e) => setF({ ...f, model: e.target.value })}
          placeholder={catalog ? `${models.length} ${f.vendor} models` : 'Loading...'}
          style={{
            height: 36, width: '100%', borderRadius: 6,
            border: `1px solid ${C.border}`, background: C.bgInput,
            padding: '0 10px', fontSize: 13, color: C.text,
            outline: 'none', fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace",
          }}
        />
        <datalist id="mount-models">
          {models.map((m) => <option key={m} value={m} />)}
        </datalist>
      </div>
    </div>
    {result && <ResultCard title="Mount Calculator Results" primary={undefined} data={result} />}
    {vendorParts.length > 0 && (
      <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, background: C.bgPanel, padding: 16 }}>
        <h3 style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Vendor Parts — {f.vendor} {f.model}
        </h3>
        {heightGuidance && (
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 10 }}>Height guidance: <span style={{ color: C.text }}>{heightGuidance}</span></div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {vendorParts.map((vp, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.18)', borderRadius: 4 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text, fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace" }}>{vp.part}</div>
                <div style={{ fontSize: 10, color: C.textDim }}>{vp.location} • {vp.environment} • J-Box: {vp.jboxRequired}</div>
              </div>
              {vp.jboxPart && (
                <div style={{ fontSize: 10, color: C.textMuted, fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace" }}>+ {vp.jboxPart}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    )}
  </div>)
}

function WirelessForm() {
  const [f, setF] = useState({ distance: '2', freq: '5.8', txPower: '27', antennaGain: '23', rxSens: '-75', heightA: '30', heightB: '30', cameras: '4', bwPerCam: '8' })
  const result = useAutoCalc(() => {
    const input: WirelessPtpInput = { radioVendor: 'Ubiquiti', radioModel: 'airFiber 5X', mode: 'ptp', distanceMiles: +f.distance, frequencyGHz: +f.freq, txPowerDbm: +f.txPower, antennaGainDbi: +f.antennaGain, rxSensitivityDbm: +f.rxSens, antennaHeightAFt: +f.heightA, antennaHeightBFt: +f.heightB, rainRateMmHr: 25, camerasPerSite: +f.cameras, bandwidthPerCameraMbps: +f.bwPerCam, maxThroughputMbps: 450, windSpeedMph: 30, antennaSurfaceAreaSqFt: 0.15, poeWattsPerCamera: 13, radioWatts: 40 }
    return calculateWirelessPtp(input) as unknown as Record<string, unknown>
  }, [f])
  const primary = result ? { label: 'Link Margin', value: formatValue(result.linkMarginDb), unit: 'dB' } : undefined
  return (<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
      <CalcInput label="Distance (miles)" value={f.distance} onChange={(v) => setF({ ...f, distance: v })} />
      <CalcInput label="Frequency (GHz)" value={f.freq} onChange={(v) => setF({ ...f, freq: v })} />
      <CalcInput label="TX Power (dBm)" value={f.txPower} onChange={(v) => setF({ ...f, txPower: v })} />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
      <CalcInput label="Antenna Gain (dBi)" value={f.antennaGain} onChange={(v) => setF({ ...f, antennaGain: v })} />
      <CalcInput label="RX Sensitivity (dBm)" value={f.rxSens} onChange={(v) => setF({ ...f, rxSens: v })} />
      <CalcInput label="Cameras/Site" value={f.cameras} onChange={(v) => setF({ ...f, cameras: v })} />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
      <CalcInput label="Height A (ft)" value={f.heightA} onChange={(v) => setF({ ...f, heightA: v })} />
      <CalcInput label="Height B (ft)" value={f.heightB} onChange={(v) => setF({ ...f, heightB: v })} />
      <CalcInput label="BW/Camera (Mbps)" value={f.bwPerCam} onChange={(v) => setF({ ...f, bwPerCam: v })} />
    </div>
    {result && <ResultCard title="Wireless PtP Results" primary={primary} data={result} />}
  </div>)
}

function AcsForm() {
  const [f, setF] = useState({ doorType: 'single', lockType: 'maglock', controllerAmps: '0.5', lockAmps: '0.6' })
  const result = useAutoCalc(() => {
    const input: AcsBuildInput = { doorType: f.doorType as AcsBuildInput['doorType'], lockType: f.lockType as AcsBuildInput['lockType'], controllerDrawAmps: +f.controllerAmps, lockDrawAmps: +f.lockAmps, hasAdo: false, isMantrap: f.doorType === 'mantrap' }
    return runAcsEngine(input) as unknown as Record<string, unknown>
  }, [f])
  return (<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      <SelectInput label="Door Type" value={f.doorType} onChange={(v) => setF({ ...f, doorType: v })} options={[{ value: 'single', label: 'Single' }, { value: 'double', label: 'Double' }, { value: 'mantrap', label: 'Mantrap' }]} />
      <SelectInput label="Lock Type" value={f.lockType} onChange={(v) => setF({ ...f, lockType: v })} options={[{ value: 'maglock', label: 'Maglock' }, { value: 'electric_strike', label: 'Electric Strike' }, { value: 'mortise', label: 'Mortise' }]} />
      <CalcInput label="Controller Amps" value={f.controllerAmps} onChange={(v) => setF({ ...f, controllerAmps: v })} />
      <CalcInput label="Lock Amps" value={f.lockAmps} onChange={(v) => setF({ ...f, lockAmps: v })} />
    </div>
    {result && <ResultCard title="ACS Build Results" primary={undefined} data={result} />}
  </div>)
}

// ---- Main page ----
const CALC_MAP: Record<string, { name: string; Form: React.FC }> = {
  'fov-dori': { name: 'FOV / DORI Calculator', Form: FovDoriForm },
  'system-storage': { name: 'System / Storage Calculator', Form: StorageForm },
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
      >
        <ArrowLeft size={14} /> Back to Calculators
      </button>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 4 }}>{calc.name}</h1>
      <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 24 }}>
        Results update live as you type. Same engine runs integrated from the design canvas.
      </p>
      <calc.Form />
    </div>
  )
}
