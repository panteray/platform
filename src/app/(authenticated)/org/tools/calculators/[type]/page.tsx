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
  calculateCoverageArea, type CoverageAreaInput,
  runPlanReview, loadJurisdictionRules, type PlanReviewInput, type JurisdictionRules,
  calculateLens, type LensCalcInput,
} from '@/lib/calculators'

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
      <label className={`block text-[10px] font-medium mb-1 uppercase tracking-wider ${error ? 'text-destructive' : 'text-muted-foreground/70'}`}>{label}</label>
      <input
        ref={ref}
        type="tel"
        inputMode="decimal"
        className={`h-9 w-full rounded-md border bg-secondary px-2.5 text-[13px] text-foreground font-mono outline-none transition-[border-color,box-shadow] duration-300 focus:border-primary ${error ? 'border-destructive' : glow ? 'ring-2 ring-primary/30 border-primary' : 'border-border'}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {error && (
        <div className="flex items-center gap-1 mt-1">
          <AlertCircle size={10} className="text-destructive" />
          <span className="text-[10px] text-destructive">{error}</span>
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
      <label className="block text-[10px] font-medium text-muted-foreground/70 mb-1 uppercase tracking-wider">{label}</label>
      <select className="h-9 w-full rounded-md border border-border bg-secondary px-2.5 text-[13px] text-foreground font-mono outline-none appearance-none focus:border-primary" value={value} onChange={(e) => onChange(e.target.value)}>
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
    <div className="rounded-lg border border-border bg-card p-4 mt-4 animate-in fade-in duration-300">
      <h3 className={`text-xs font-semibold text-foreground uppercase tracking-wider ${primary ? 'mb-2' : 'mb-3'}`}>{title}</h3>

      {/* Primary metric — hero display */}
      {primary && (
        <div className="flex items-baseline gap-1.5 py-3 mb-3 border-b border-border">
          <span className="text-2xl font-bold text-primary font-mono">
            {primary.value}
          </span>
          {primary.unit && <span className="text-sm text-muted-foreground ml-1">{primary.unit}</span>}
          <span className="text-[11px] text-muted-foreground/70 ml-1">{primary.label}</span>
        </div>
      )}

      {/* Secondary metrics grid */}
      <div className="grid grid-cols-2">
        {entries.map(([k, v], i) => (
          <div key={k} className={`flex justify-between items-center py-2 ${i < entries.length - 2 ? 'border-b border-border' : ''}`}>
            <span className="text-[11px] text-muted-foreground">{formatKey(k)}</span>
            <span className="text-[11px] font-semibold text-foreground font-mono">
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
  return (<div className="flex flex-col gap-3">
    <div className="grid grid-cols-4 gap-3">
      <CalcInput label="Resolution W (px)" value={f.resW} onChange={(v) => setF({ ...f, resW: v })} error={+f.resW <= 0 ? 'Required' : undefined} />
      <CalcInput label="Resolution H (px)" value={f.resH} onChange={(v) => setF({ ...f, resH: v })} error={+f.resH <= 0 ? 'Required' : undefined} />
      <CalcInput label="Sensor W (mm)" value={f.sensorW} onChange={(v) => setF({ ...f, sensorW: v })} error={+f.sensorW <= 0 ? 'Required' : undefined} />
      <CalcInput label="Sensor H (mm)" value={f.sensorH} onChange={(v) => setF({ ...f, sensorH: v })} />
    </div>
    <div className="grid grid-cols-4 gap-3">
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
  return (<div className="flex flex-col gap-3">
    <div className="grid grid-cols-5 gap-3">
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
  return (<div className="flex flex-col gap-3">
    <div className="grid grid-cols-3 gap-3">
      <SelectInput label="Schematic Type" value={f.schematicType} onChange={(v) => setF({ ...f, schematicType: v })} options={[{ value: 'standard_door', label: 'Standard' }, { value: 'ada_auto_operator', label: 'ADA Auto' }, { value: 'mantrap', label: 'Mantrap' }, { value: 'mantrap_ada', label: 'Mantrap ADA' }]} />
      <SelectInput label="Controller Brand" value={f.controllerBrand} onChange={(v) => setF({ ...f, controllerBrand: v })} options={[{ value: 'mercury', label: 'Mercury' }, { value: 'verkada', label: 'Verkada' }, { value: 'brivo', label: 'Brivo' }, { value: 'genetec', label: 'Genetec' }, { value: 'avigilon_alta', label: 'Avigilon Alta' }, { value: 'generic', label: 'Generic' }]} />
      <CalcInput label="Door Name" value={f.doorName} onChange={(v) => setF({ ...f, doorName: v })} />
    </div>
    <div className="grid grid-cols-2 gap-3">
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
  return (<div className="flex flex-col gap-3">
    <div className="grid grid-cols-5 gap-3">
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
  const [f, setF] = useState({ formFactor: 'dome', mountType: 'ceiling', weight: '1.2', diameter: '130', vendor: 'Hanwha', model: '', finish: 'white' as 'white' | 'black' })
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
      finish: f.finish,
    }
    return calculateMountRequirements(input, 0, catalog) as unknown as Record<string, unknown>
  }, [f, catalog])

  const vendorParts = (result?.vendorParts as VendorMountPart[] | undefined) ?? []
  const heightGuidance = (result?.heightGuidance as string | null | undefined) ?? null

  return (<div className="flex flex-col gap-3">
    <div className="grid grid-cols-4 gap-3">
      <SelectInput label="Form Factor" value={f.formFactor} onChange={(v) => setF({ ...f, formFactor: v })} options={[{ value: 'dome', label: 'Dome' }, { value: 'bullet', label: 'Bullet' }, { value: 'turret', label: 'Turret' }, { value: 'ptz', label: 'PTZ' }, { value: 'fisheye', label: 'Fisheye' }]} />
      <SelectInput label="Mount Type" value={f.mountType} onChange={(v) => setF({ ...f, mountType: v })} options={[{ value: 'ceiling', label: 'Ceiling' }, { value: 'wall', label: 'Wall' }, { value: 'pole', label: 'Pole' }, { value: 'pendant', label: 'Pendant' }]} />
      <CalcInput label="Weight (kg)" value={f.weight} onChange={(v) => setF({ ...f, weight: v })} />
      <CalcInput label="Diameter (mm)" value={f.diameter} onChange={(v) => setF({ ...f, diameter: v })} />
    </div>
    <div className="grid grid-cols-[1fr_1fr_120px] gap-3">
      <SelectInput label="Vendor (Catalog)" value={f.vendor} onChange={(v) => setF({ ...f, vendor: v, model: '' })} options={MOUNT_CATALOG_VENDORS.map(v => ({ value: v, label: v }))} />
      <div>
        <label className="block text-[10px] font-medium text-muted-foreground/70 mb-1 uppercase tracking-wider">Model</label>
        <input
          list="mount-models"
          type="text"
          value={f.model}
          onChange={(e) => setF({ ...f, model: e.target.value })}
          placeholder={catalog ? `${models.length} ${f.vendor} models` : 'Loading...'}
          className="h-9 w-full rounded-md border border-border bg-secondary px-2.5 text-[13px] text-foreground font-mono outline-none"
        />
        <datalist id="mount-models">
          {models.map((m) => <option key={m} value={m} />)}
        </datalist>
      </div>
      <SelectInput label="Finish" value={f.finish} onChange={(v) => setF({ ...f, finish: v as 'white' | 'black' })} options={[{ value: 'white', label: 'White' }, { value: 'black', label: 'Black' }]} />
    </div>
    {result && <ResultCard title="Mount Calculator Results" primary={undefined} data={result} />}
    {vendorParts.length > 0 && (
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-xs font-semibold text-foreground mb-2.5 uppercase tracking-wider">
          Vendor Parts — {f.vendor} {f.model}
        </h3>
        {heightGuidance && (
          <div className="text-[11px] text-muted-foreground mb-2.5">Height guidance: <span className="text-foreground">{heightGuidance}</span></div>
        )}
        <div className="flex flex-col gap-1.5">
          {vendorParts.map((vp, i) => (
            <div key={i} className="flex justify-between items-center py-2 px-2.5 bg-success/5 border border-success/20 rounded">
              <div>
                <div className="text-xs font-semibold text-foreground font-mono">{vp.part}</div>
                <div className="text-[10px] text-muted-foreground/70">{vp.location} • {vp.environment} • J-Box: {vp.jboxRequired}</div>
              </div>
              {vp.jboxPart && (
                <div className="text-[10px] text-muted-foreground font-mono">+ {vp.jboxPart}</div>
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
  return (<div className="flex flex-col gap-3">
    <div className="grid grid-cols-3 gap-3">
      <CalcInput label="Distance (miles)" value={f.distance} onChange={(v) => setF({ ...f, distance: v })} />
      <CalcInput label="Frequency (GHz)" value={f.freq} onChange={(v) => setF({ ...f, freq: v })} />
      <CalcInput label="TX Power (dBm)" value={f.txPower} onChange={(v) => setF({ ...f, txPower: v })} />
    </div>
    <div className="grid grid-cols-3 gap-3">
      <CalcInput label="Antenna Gain (dBi)" value={f.antennaGain} onChange={(v) => setF({ ...f, antennaGain: v })} />
      <CalcInput label="RX Sensitivity (dBm)" value={f.rxSens} onChange={(v) => setF({ ...f, rxSens: v })} />
      <CalcInput label="Cameras/Site" value={f.cameras} onChange={(v) => setF({ ...f, cameras: v })} />
    </div>
    <div className="grid grid-cols-3 gap-3">
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
  return (<div className="flex flex-col gap-3">
    <div className="grid grid-cols-4 gap-3">
      <SelectInput label="Door Type" value={f.doorType} onChange={(v) => setF({ ...f, doorType: v })} options={[{ value: 'single', label: 'Single' }, { value: 'double', label: 'Double' }, { value: 'mantrap', label: 'Mantrap' }]} />
      <SelectInput label="Lock Type" value={f.lockType} onChange={(v) => setF({ ...f, lockType: v })} options={[{ value: 'maglock', label: 'Maglock' }, { value: 'electric_strike', label: 'Electric Strike' }, { value: 'mortise', label: 'Mortise' }]} />
      <CalcInput label="Controller Amps" value={f.controllerAmps} onChange={(v) => setF({ ...f, controllerAmps: v })} />
      <CalcInput label="Lock Amps" value={f.lockAmps} onChange={(v) => setF({ ...f, lockAmps: v })} />
    </div>
    {result && <ResultCard title="ACS Build Results" primary={undefined} data={result} />}
  </div>)
}

function CoverageAreaForm() {
  const [f, setF] = useState({
    roomW: '40', roomL: '60',
    sensor: '5.14', focal: '4', resW: '1920',
    dori: 'recognition' as 'detection' | 'observation' | 'recognition' | 'identification',
    overlap: '15',
  })
  const result = useAutoCalc(() => {
    const input: CoverageAreaInput = {
      roomWidthFt: +f.roomW,
      roomLengthFt: +f.roomL,
      sensorWmm: +f.sensor,
      focalLengthMm: +f.focal,
      resolutionW: +f.resW,
      doriLevel: f.dori,
      overlapPct: +f.overlap,
    }
    return calculateCoverageArea(input) as unknown as Record<string, unknown>
  }, [f])
  const primary = result ? { label: 'Cameras Required', value: String(result.cameraCount), unit: '' } : undefined
  const warnings = (result?.warnings as string[] | undefined) ?? []
  return (<div className="flex flex-col gap-3">
    <div className="grid grid-cols-2 gap-3">
      <CalcInput label="Room Width (ft)" value={f.roomW} onChange={(v) => setF({ ...f, roomW: v })} />
      <CalcInput label="Room Length (ft)" value={f.roomL} onChange={(v) => setF({ ...f, roomL: v })} />
    </div>
    <div className="grid grid-cols-3 gap-3">
      <CalcInput label="Sensor Width (mm)" value={f.sensor} onChange={(v) => setF({ ...f, sensor: v })} />
      <CalcInput label="Focal Length (mm)" value={f.focal} onChange={(v) => setF({ ...f, focal: v })} />
      <CalcInput label="Horizontal Resolution (px)" value={f.resW} onChange={(v) => setF({ ...f, resW: v })} />
    </div>
    <div className="grid grid-cols-2 gap-3">
      <SelectInput label="DORI Target" value={f.dori} onChange={(v) => setF({ ...f, dori: v as typeof f.dori })} options={[
        { value: 'detection', label: 'Detection (8 PPF)' },
        { value: 'observation', label: 'Observation (19 PPF)' },
        { value: 'recognition', label: 'Recognition (38 PPF)' },
        { value: 'identification', label: 'Identification (76 PPF)' },
      ]} />
      <CalcInput label="Overlap (%)" value={f.overlap} onChange={(v) => setF({ ...f, overlap: v })} />
    </div>
    {result && <ResultCard title="Coverage Area Results" primary={primary} data={result} />}
    {warnings.length > 0 && (
      <div className="rounded-lg border border-warning bg-warning/5 p-3">
        <div className="text-[11px] font-semibold text-warning mb-1.5">Warnings</div>
        {warnings.map((w, i) => (
          <div key={i} className="text-[11px] text-muted-foreground">• {w}</div>
        ))}
      </div>
    )}
  </div>)
}

interface PlanReviewRow {
  id: string
  kind: 'device' | 'door' | 'controller'
  label: string
  vendor: string
  category: string
  electrification: string
  fireRated: boolean
  occupancy: string
  readerHeightIn: string
  clearanceIn: string
  ulListed: boolean
  intendedUse: string
  calculatedPpf: string
}

function PlanReviewForm() {
  const [projectType, setProjectType] = useState<PlanReviewInput['projectType']>('commercial')
  const [jurisdiction, setJurisdiction] = useState<PlanReviewInput['jurisdiction']>('state')
  const [rows, setRows] = useState<PlanReviewRow[]>([
    { id: 'R1', kind: 'device', label: 'Lobby Cam', vendor: 'Axis', category: 'cctv', electrification: '', fireRated: false, occupancy: '', readerHeightIn: '', clearanceIn: '', ulListed: true, intendedUse: 'recognition', calculatedPpf: '45' },
    { id: 'R2', kind: 'door', label: 'Main Entry', vendor: '', category: '', electrification: 'maglock', fireRated: true, occupancy: 'Business', readerHeightIn: '46', clearanceIn: '', ulListed: true, intendedUse: '', calculatedPpf: '' },
    { id: 'R3', kind: 'controller', label: 'ACS Panel IDF-1', vendor: 'Mercury', category: '', electrification: '', fireRated: false, occupancy: '', readerHeightIn: '', clearanceIn: '30', ulListed: true, intendedUse: '', calculatedPpf: '' },
  ])
  const [rules, setRules] = useState<JurisdictionRules | null>(null)

  useEffect(() => {
    loadJurisdictionRules().then(setRules).catch(() => setRules({ version: '0', updated: '', rules: {} }))
  }, [])

  const result = useAutoCalc(() => {
    if (!rules) return null
    const input: PlanReviewInput = {
      projectType,
      jurisdiction,
      devices: rows
        .filter((r) => r.kind === 'device')
        .map((r) => ({
          id: r.id,
          label: r.label,
          category: (r.category || 'other') as PlanReviewInput['devices'][number]['category'],
          vendor: r.vendor || undefined,
          ulListed: r.ulListed,
          intendedUse: (r.intendedUse || undefined) as PlanReviewInput['devices'][number]['intendedUse'],
          calculatedPpf: r.calculatedPpf ? +r.calculatedPpf : undefined,
        })),
      doors: rows
        .filter((r) => r.kind === 'door')
        .map((r) => ({
          id: r.id,
          label: r.label,
          electrification: (r.electrification || undefined) as PlanReviewInput['doors'][number]['electrification'],
          fireRated: r.fireRated,
          occupancy: r.occupancy || undefined,
          readerHeightIn: r.readerHeightIn ? +r.readerHeightIn : undefined,
        })),
      controllers: rows
        .filter((r) => r.kind === 'controller')
        .map((r) => ({
          id: r.id,
          label: r.label,
          workingClearanceIn: r.clearanceIn ? +r.clearanceIn : undefined,
          ulListed: r.ulListed,
        })),
    }
    return runPlanReview(input, rules) as unknown as Record<string, unknown>
  }, [rows, projectType, jurisdiction, rules])

  const findings = (result?.findings as Array<{ ruleId: string; title: string; codeRef: string; severity: string; message: string; entityLabel?: string; fixHint?: string }> | undefined) ?? []
  const summary = result?.summary as { critical: number; warning: number; info: number; total: number } | undefined

  const addRow = (kind: PlanReviewRow['kind']) => {
    const id = `R${rows.length + 1}`
    setRows([...rows, { id, kind, label: `New ${kind}`, vendor: '', category: kind === 'device' ? 'cctv' : '', electrification: '', fireRated: false, occupancy: '', readerHeightIn: '', clearanceIn: '', ulListed: true, intendedUse: '', calculatedPpf: '' }])
  }
  const removeRow = (id: string) => setRows(rows.filter((r) => r.id !== id))
  const updateRow = (id: string, patch: Partial<PlanReviewRow>) => setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const severityColor = (s: string) => s === 'critical' ? 'text-destructive' : s === 'warning' ? 'text-warning' : 'text-primary'
  const severityBorderColor = (s: string) => s === 'critical' ? 'border-destructive' : s === 'warning' ? 'border-warning' : 'border-primary'

  return (<div className="flex flex-col gap-3">
    <div className="grid grid-cols-2 gap-3">
      <SelectInput label="Project Type" value={projectType} onChange={(v) => setProjectType(v as PlanReviewInput['projectType'])} options={[
        { value: 'commercial', label: 'Commercial' },
        { value: 'federal', label: 'Federal' },
        { value: 'education', label: 'Education' },
        { value: 'healthcare', label: 'Healthcare' },
        { value: 'assembly', label: 'Assembly' },
      ]} />
      <SelectInput label="Jurisdiction" value={jurisdiction} onChange={(v) => setJurisdiction(v as PlanReviewInput['jurisdiction'])} options={[
        { value: 'federal', label: 'Federal' },
        { value: 'state', label: 'State' },
        { value: 'local', label: 'Local' },
      ]} />
    </div>

    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex justify-between items-center mb-2">
        <div className="text-[11px] font-semibold text-foreground uppercase tracking-wider">Entities</div>
        <div className="flex gap-1.5">
          <button onClick={() => addRow('device')} className="text-[11px] py-1 px-2.5 rounded border border-border bg-primary/10 text-primary cursor-pointer">+ Device</button>
          <button onClick={() => addRow('door')} className="text-[11px] py-1 px-2.5 rounded border border-border bg-primary/10 text-primary cursor-pointer">+ Door</button>
          <button onClick={() => addRow('controller')} className="text-[11px] py-1 px-2.5 rounded border border-border bg-primary/10 text-primary cursor-pointer">+ Controller</button>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <div key={r.id} className="grid grid-cols-[60px_1fr_1fr_1fr_1fr_30px] gap-1.5 items-center p-1.5 bg-secondary rounded border border-border">
            <span className="text-[9px] font-bold text-primary uppercase">{r.kind}</span>
            <input value={r.label} onChange={(e) => updateRow(r.id, { label: e.target.value })} placeholder="Label" className="text-[11px] py-1 px-1.5 bg-background border border-border rounded-sm text-foreground" />
            {r.kind === 'device' && (
              <>
                <input value={r.vendor} onChange={(e) => updateRow(r.id, { vendor: e.target.value })} placeholder="Vendor" className="text-[11px] py-1 px-1.5 bg-background border border-border rounded-sm text-foreground" />
                <select value={r.category} onChange={(e) => updateRow(r.id, { category: e.target.value })} className="text-[11px] py-1 px-1.5 bg-background border border-border rounded-sm text-foreground">
                  <option value="cctv">CCTV</option>
                  <option value="access_control">Access Control</option>
                  <option value="network">Network</option>
                  <option value="av">AV</option>
                  <option value="other">Other</option>
                </select>
                <input value={r.calculatedPpf} onChange={(e) => updateRow(r.id, { calculatedPpf: e.target.value })} placeholder="PPF" className="text-[11px] py-1 px-1.5 bg-background border border-border rounded-sm text-foreground" />
              </>
            )}
            {r.kind === 'door' && (
              <>
                <select value={r.electrification} onChange={(e) => updateRow(r.id, { electrification: e.target.value })} className="text-[11px] py-1 px-1.5 bg-background border border-border rounded-sm text-foreground">
                  <option value="">—</option>
                  <option value="maglock">Maglock</option>
                  <option value="electric_strike">Electric Strike</option>
                  <option value="electrified_lockset">Electrified Lockset</option>
                  <option value="delayed_egress">Delayed Egress</option>
                  <option value="mechanical">Mechanical</option>
                </select>
                <select value={r.occupancy} onChange={(e) => updateRow(r.id, { occupancy: e.target.value })} className="text-[11px] py-1 px-1.5 bg-background border border-border rounded-sm text-foreground">
                  <option value="">Occupancy</option>
                  <option value="Assembly">Assembly</option>
                  <option value="Business">Business</option>
                  <option value="Educational">Educational</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Mercantile">Mercantile</option>
                </select>
                <input value={r.readerHeightIn} onChange={(e) => updateRow(r.id, { readerHeightIn: e.target.value })} placeholder="Reader Hgt (in)" className="text-[11px] py-1 px-1.5 bg-background border border-border rounded-sm text-foreground" />
                <label className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <input type="checkbox" checked={r.fireRated} onChange={(e) => updateRow(r.id, { fireRated: e.target.checked })} /> Fire-rated
                </label>
              </>
            )}
            {r.kind === 'controller' && (
              <>
                <input value={r.vendor} onChange={(e) => updateRow(r.id, { vendor: e.target.value })} placeholder="Vendor" className="text-[11px] py-1 px-1.5 bg-background border border-border rounded-sm text-foreground" />
                <input value={r.clearanceIn} onChange={(e) => updateRow(r.id, { clearanceIn: e.target.value })} placeholder="Clearance (in)" className="text-[11px] py-1 px-1.5 bg-background border border-border rounded-sm text-foreground" />
                <label className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <input type="checkbox" checked={r.ulListed} onChange={(e) => updateRow(r.id, { ulListed: e.target.checked })} /> UL Listed
                </label>
                <span />
              </>
            )}
            <button onClick={() => removeRow(r.id)} className="text-xs bg-transparent text-destructive border-none cursor-pointer">✕</button>
          </div>
        ))}
      </div>
    </div>

    {summary && (
      <div className="grid grid-cols-4 gap-2">
        <div className="p-3 rounded-md bg-destructive/10 border border-destructive">
          <div className="text-[10px] text-destructive font-semibold uppercase">Critical</div>
          <div className="text-xl font-bold text-destructive font-mono">{summary.critical}</div>
        </div>
        <div className="p-3 rounded-md bg-warning/10 border border-warning">
          <div className="text-[10px] text-warning font-semibold uppercase">Warning</div>
          <div className="text-xl font-bold text-warning font-mono">{summary.warning}</div>
        </div>
        <div className="p-3 rounded-md bg-primary/10 border border-primary">
          <div className="text-[10px] text-primary font-semibold uppercase">Info</div>
          <div className="text-xl font-bold text-primary font-mono">{summary.info}</div>
        </div>
        <div className="p-3 rounded-md bg-card border border-border">
          <div className="text-[10px] text-muted-foreground font-semibold uppercase">Total</div>
          <div className="text-xl font-bold text-foreground font-mono">{summary.total}</div>
        </div>
      </div>
    )}

    {findings.length > 0 && (
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="text-[11px] font-semibold text-foreground mb-2 uppercase tracking-wider">Findings</div>
        <div className="flex flex-col gap-1.5">
          {findings.map((f, i) => (
            <div key={i} className={`p-2.5 bg-secondary border-l-[3px] ${severityBorderColor(f.severity)} rounded-sm`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[9px] font-bold ${severityColor(f.severity)} uppercase`}>{f.severity}</span>
                <span className="text-[10px] text-muted-foreground/70 font-mono">{f.codeRef}</span>
              </div>
              <div className="text-xs text-foreground mb-0.5">{f.message}</div>
              {f.fixHint && <div className="text-[10px] text-muted-foreground italic">Fix: {f.fixHint}</div>}
            </div>
          ))}
        </div>
      </div>
    )}
    {findings.length === 0 && result && (
      <div className="p-3 rounded-md bg-success/10 border border-success text-success text-xs font-semibold text-center">
        ✓ No compliance issues found
      </div>
    )}
  </div>)
}

function LensForm() {
  const [f, setF] = useState({
    distance: '30',
    sensor: '5.14',
    resW: '1920',
    dori: 'identification' as 'detection' | 'observation' | 'recognition' | 'identification' | 'inspection',
    overridePpf: '',
  })
  const result = useAutoCalc(() => {
    const override = parseFloat(f.overridePpf)
    const input: LensCalcInput = {
      distanceFt: +f.distance,
      sensorWmm: +f.sensor,
      resolutionW: +f.resW,
      doriLevel: f.dori,
      overridePpf: Number.isFinite(override) && override > 0 ? override : undefined,
    }
    return calculateLens(input) as unknown as Record<string, unknown>
  }, [f])
  const primary = result
    ? { label: 'Required Focal Length', value: (result.requiredFocalMm as number).toFixed(2), unit: 'mm' }
    : undefined
  const warnings = (result?.warnings as string[] | undefined) ?? []
  return (<div className="flex flex-col gap-3">
    <div className="grid grid-cols-3 gap-3">
      <CalcInput label="Distance to Target (ft)" value={f.distance} onChange={(v) => setF({ ...f, distance: v })} />
      <CalcInput label="Sensor Width (mm)" value={f.sensor} onChange={(v) => setF({ ...f, sensor: v })} />
      <CalcInput label="Horizontal Resolution (px)" value={f.resW} onChange={(v) => setF({ ...f, resW: v })} />
    </div>
    <div className="grid grid-cols-2 gap-3">
      <SelectInput label="DORI Target" value={f.dori} onChange={(v) => setF({ ...f, dori: v as typeof f.dori })} options={[
        { value: 'detection', label: 'Detection (8 PPF)' },
        { value: 'observation', label: 'Observation (19 PPF)' },
        { value: 'recognition', label: 'Recognition (38 PPF)' },
        { value: 'identification', label: 'Identification (76 PPF)' },
        { value: 'inspection', label: 'Inspection (305 PPF)' },
      ]} />
      <CalcInput label="Override PPF (optional)" value={f.overridePpf} onChange={(v) => setF({ ...f, overridePpf: v })} placeholder="e.g. 120" />
    </div>
    {result && <ResultCard title="Lens Selection Results" primary={primary} data={result} />}
    {warnings.length > 0 && (
      <div className="rounded-lg border border-warning bg-warning/5 p-3">
        <div className="text-[11px] font-semibold text-warning mb-1.5">Warnings</div>
        {warnings.map((w, i) => (
          <div key={i} className="text-[11px] text-muted-foreground">• {w}</div>
        ))}
      </div>
    )}
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
  'coverage-area': { name: 'Coverage Area Calculator', Form: CoverageAreaForm },
  'lens': { name: 'Lens Calculator', Form: LensForm },
  'plan-review': { name: 'Plan Review (Compliance Checker)', Form: PlanReviewForm },
}

export default function CalculatorDetailPage() {
  const params = useParams()
  const router = useRouter()
  const calcType = params.type as string
  const calc = CALC_MAP[calcType]

  if (!calc) return (
    <div className="p-6">
      <p className="text-sm text-muted-foreground">Unknown calculator type: {calcType}</p>
    </div>
  )

  return (
    <div className="max-w-4xl">
      <button onClick={() => router.push('/org/tools/calculators')}
        className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 mb-4 bg-transparent border-none cursor-pointer p-0"
      >
        <ArrowLeft size={14} /> Back to Calculators
      </button>
      <h1 className="text-2xl font-bold text-foreground mb-1">{calc.name}</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Results update live as you type. Same engine runs integrated from the design canvas.
      </p>
      <calc.Form />
    </div>
  )
}
