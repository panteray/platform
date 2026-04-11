'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  Camera, DoorOpen, Wifi, Speaker, Wind, Package, HardDrive,
  MapPin, User, Phone, Mail, FileText, AlertTriangle, ArrowRight,
  Shield, Gauge,
} from 'lucide-react'
import { C } from './constants'
import { calculateSystemStorage, canvasDevicesToCameraSpecs } from '@/lib/calculators'
import type { SystemStorageOutput } from '@/lib/calculators/system-storage'
import type { DesignDevice, DesignCable } from '@/types/database'

interface DesignDashboardProps {
  designId: string
  onNavigateCanvas: () => void
}

interface OppData {
  opp_number?: string
  project_name?: string
  customer_name?: string
  install_address?: string
  state?: string
  poc_name?: string
  poc_phone?: string
  poc_email?: string
  disciplines?: string[]
}

const CAMERA_TYPES = ['cctv', 'dome', 'bullet', 'turret', 'ptz', 'fisheye', 'multisensor_quad', 'multisensor_dual']
const NETWORK_TYPES = ['network', 'switch', 'access_switch', 'rack', 'nvr', 'router', 'firewall', 'wireless_ap', 'bridge', 'server', 'poe_switch']
const ACS_TYPES = ['access_control', 'door', 'card_reader', 'electric_strike', 'maglock', 'door_controller']
const AV_TYPES = ['av', 'speaker', 'monitor', 'amplifier']
const VAPE_ENV_TYPES = ['vape_environmental', 'vape_detector', 'environmental_detector']

// --- Reusable sub-components ---

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: C.bgSurface, border: `1px solid ${C.border}`, borderRadius: 8,
      padding: 20, ...style,
    }}>
      {children}
    </div>
  )
}

function SectionTitle({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <Icon size={16} color={C.accent} />
      <span style={{ fontSize: 13, fontWeight: 600, color: C.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
    </div>
  )
}

function StatRow({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0', borderBottom: `1px solid ${C.borderSubtle}` }}>
      <span style={{ fontSize: 13, color: C.textMuted }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{value}</span>
        {sub && <span style={{ fontSize: 11, color: C.textDim, marginLeft: 4 }}>{sub}</span>}
      </div>
    </div>
  )
}

/** SVG Donut Chart — replaces flat progress bars */
function DonutChart({ segments, size = 140, strokeWidth = 24 }: {
  segments: Array<{ label: string; value: number; color: string }>
  size?: number
  strokeWidth?: number
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  if (total === 0) return null
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <svg width={size} height={size} style={{ flexShrink: 0 }}>
        {/* Background ring */}
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={C.bgActive} strokeWidth={strokeWidth} />
        {/* Segments */}
        {segments.filter(s => s.value > 0).map((seg) => {
          const pct = seg.value / total
          const dashLen = circumference * pct
          const dashOffset = -offset * circumference
          offset += pct
          return (
            <circle key={seg.label}
              cx={size / 2} cy={size / 2} r={radius}
              fill="none" stroke={seg.color} strokeWidth={strokeWidth}
              strokeDasharray={`${dashLen} ${circumference - dashLen}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="butt"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{ transition: 'stroke-dasharray 0.5s ease' }}
            />
          )
        })}
        {/* Center text */}
        <text x={size / 2} y={size / 2 - 6} textAnchor="middle" fill={C.text} fontSize={22} fontWeight={700} fontFamily="'SF Mono', 'Cascadia Code', 'Consolas', monospace">
          {total}
        </text>
        <text x={size / 2} y={size / 2 + 12} textAnchor="middle" fill={C.textDim} fontSize={10}>
          devices
        </text>
      </svg>
      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {segments.filter(s => s.value > 0).map((seg) => (
          <div key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: C.textMuted, width: 90 }}>{seg.label}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace" }}>{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** SVG Circular Progress Ring (Axis Site Designer pattern) */
function ProgressRing({ label, value, max, unit, size = 80, strokeWidth = 6 }: {
  label: string; value: number; max: number; unit?: string; size?: number; strokeWidth?: number
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dashLen = (pct / 100) * circumference
  const color = pct >= 100 ? C.green : pct >= 50 ? C.yellow : C.red

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={size} height={size}>
        {/* Background */}
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={C.bgActive} strokeWidth={strokeWidth} />
        {/* Fill */}
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={`${dashLen} ${circumference - dashLen}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
        {/* Center value */}
        <text x={size / 2} y={size / 2 + 1} textAnchor="middle" fill={C.text}
          fontSize={14} fontWeight={700} fontFamily="'SF Mono', 'Cascadia Code', 'Consolas', monospace">
          {typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(1) : value}
        </text>
        {unit && (
          <text x={size / 2} y={size / 2 + 14} textAnchor="middle" fill={C.textDim} fontSize={8}>
            {unit}
          </text>
        )}
      </svg>
      <span style={{ fontSize: 10, color: C.textMuted, textAlign: 'center' }}>{label}</span>
      {max > 0 && (
        <span style={{ fontSize: 9, color: C.textDim }}>/ {max} {unit ?? ''}</span>
      )}
    </div>
  )
}

/** Improved Risk Gauge — arc-style */
function RiskGauge({ label, score, max }: { label: string; score: number; max: number }) {
  const pct = max > 0 ? Math.min((score / max) * 100, 100) : 0
  const color = pct < 33 ? C.green : pct < 66 ? C.yellow : C.red
  const riskLabel = pct < 33 ? 'Low' : pct < 66 ? 'Medium' : 'High'
  const arcRadius = 30
  const arcCirc = Math.PI * arcRadius // half circle
  const arcFill = (pct / 100) * arcCirc

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
      <svg width={68} height={38} viewBox="0 0 68 38">
        {/* Background arc */}
        <path d={`M 4 34 A ${arcRadius} ${arcRadius} 0 0 1 64 34`}
          fill="none" stroke={C.bgActive} strokeWidth={5} strokeLinecap="round" />
        {/* Fill arc */}
        <path d={`M 4 34 A ${arcRadius} ${arcRadius} 0 0 1 64 34`}
          fill="none" stroke={color} strokeWidth={5} strokeLinecap="round"
          strokeDasharray={`${arcFill} ${arcCirc}`}
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
        <text x={34} y={32} textAnchor="middle" fill={color} fontSize={11} fontWeight={700} fontFamily="'SF Mono', 'Cascadia Code', 'Consolas', monospace">{riskLabel}</text>
      </svg>
      <div>
        <div style={{ fontSize: 12, color: C.textMuted }}>{label}</div>
        <div style={{ fontSize: 10, color: C.textDim }}>{score}/{max}</div>
      </div>
    </div>
  )
}

// --- Main Dashboard ---

export function DesignDashboard({ designId, onNavigateCanvas }: DesignDashboardProps) {
  const [designName, setDesignName] = useState('')
  const [opp, setOpp] = useState<OppData | null>(null)
  const [devices, setDevices] = useState<DesignDevice[]>([])
  const [cables, setCables] = useState<DesignCable[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [designRes, devRes, cabRes] = await Promise.all([
          fetch(`/api/org/designs/${designId}`),
          fetch(`/api/org/designs/${designId}/devices`),
          fetch(`/api/org/designs/${designId}/cables`),
        ])
        if (cancelled) return
        if (designRes.ok) {
          const dj = await designRes.json()
          setDesignName(dj.design?.name ?? '')
          setOpp((dj.design?.opportunities as OppData) ?? null)
        }
        if (devRes.ok) {
          const devJson = await devRes.json()
          setDevices(devJson.devices ?? [])
        }
        if (cabRes.ok) {
          const cabJson = await cabRes.json()
          setCables(cabJson.cables ?? [])
        }
      } catch { /* swallow */ }
      if (!cancelled) setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [designId])

  const counts = useMemo(() => {
    const cam = devices.filter(d => CAMERA_TYPES.includes(d.category)).length
    const acs = devices.filter(d => ACS_TYPES.includes(d.category)).length
    const net = devices.filter(d => NETWORK_TYPES.includes(d.category)).length
    const av = devices.filter(d => AV_TYPES.includes(d.category)).length
    const vape = devices.filter(d => VAPE_ENV_TYPES.includes(d.category)).length
    const other = devices.length - cam - acs - net - av - vape
    return { cam, acs, net, av, vape, other, total: devices.length }
  }, [devices])

  const storageOutput: SystemStorageOutput | null = useMemo(() => {
    const camDevices = devices
      .filter(d => CAMERA_TYPES.includes(d.category))
      .map(d => ({ id: d.id, label: d.label || '', category: 'cctv' as const, properties: (d.properties ?? {}) as Record<string, unknown> }))
    if (camDevices.length === 0) return null
    const specs = canvasDevicesToCameraSpecs(camDevices)
    if (specs.length === 0) return null
    try { return calculateSystemStorage({ cameras: specs, retentionDays: 30, raidLevel: 6, driveSizeTB: 10 }) }
    catch { return null }
  }, [devices])

  const cableTotal = useMemo(() => cables.reduce((s, c) => s + (c.length_ft ?? 0), 0), [cables])

  const risk = useMemo(() => {
    const camScore = counts.cam <= 10 ? counts.cam : counts.cam <= 50 ? 10 + (counts.cam - 10) * 0.5 : 30 + (counts.cam - 50) * 0.3
    const doorScore = counts.acs <= 5 ? counts.acs : counts.acs <= 20 ? 5 + (counts.acs - 5) * 0.8 : 17 + (counts.acs - 20) * 0.5
    const pathScore = cableTotal <= 1000 ? cableTotal / 100 : cableTotal <= 5000 ? 10 + (cableTotal - 1000) / 400 : 20 + (cableTotal - 5000) / 1000
    const overall = (camScore + doorScore + pathScore) / 3
    return {
      camera: Math.min(Math.round(camScore), 30),
      door: Math.min(Math.round(doorScore), 30),
      pathway: Math.min(Math.round(pathScore), 30),
      overall: Math.min(Math.round(overall), 30),
    }
  }, [counts, cableTotal])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: C.bg }}>
        <span style={{ color: C.textDim, fontSize: 13 }}>Loading dashboard...</span>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', overflow: 'auto', background: C.bg, padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>{designName || 'Untitled Design'}</h1>
          {opp?.opp_number && <span style={{ fontSize: 13, color: C.textMuted }}>{opp.opp_number}</span>}
        </div>
        <button
          onClick={onNavigateCanvas}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            background: C.accent, color: '#fff', border: 'none', borderRadius: 6,
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Open Canvas <ArrowRight size={14} />
        </button>
      </div>

      {/* Grid layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* OPP Info */}
        <Card>
          <SectionTitle icon={FileText} label="Opportunity Details" />
          <StatRow label="Project Name" value={opp?.project_name || '—'} />
          <StatRow label="Customer" value={opp?.customer_name || '—'} />
          <StatRow label="Address" value={opp?.install_address ? `${opp.install_address}${opp.state ? ', ' + opp.state : ''}` : '—'} />
          {opp?.poc_name && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: C.bgPanel, borderRadius: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <User size={12} color={C.textDim} />
                <span style={{ fontSize: 12, color: C.textMuted }}>Point of Contact</span>
              </div>
              <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{opp.poc_name}</div>
              {opp.poc_phone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <Phone size={11} color={C.textDim} />
                  <span style={{ fontSize: 12, color: C.textMuted }}>{opp.poc_phone}</span>
                </div>
              )}
              {opp.poc_email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <Mail size={11} color={C.textDim} />
                  <span style={{ fontSize: 12, color: C.textMuted }}>{opp.poc_email}</span>
                </div>
              )}
            </div>
          )}
          {opp?.disciplines && opp.disciplines.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <span style={{ fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>Disciplines</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                {opp.disciplines.map(d => (
                  <span key={d} style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 4,
                    background: C.accentSubtle, color: C.accent, fontWeight: 500,
                  }}>{d}</span>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Device Summary — SVG Donut */}
        <Card>
          <SectionTitle icon={Package} label="Device Summary" />
          <DonutChart segments={[
            { label: 'Cameras', value: counts.cam, color: '#3b82f6' },
            { label: 'Access Control', value: counts.acs, color: '#f97316' },
            { label: 'Network', value: counts.net, color: '#22c55e' },
            { label: 'AV', value: counts.av, color: '#8b5cf6' },
            { label: 'Vape/Env', value: counts.vape, color: '#ef4444' },
            { label: 'Other', value: counts.other, color: C.textDim },
          ]} />
        </Card>

        {/* Project Requirements — Circular Progress Rings (Axis pattern) */}
        <Card>
          <SectionTitle icon={Gauge} label="Project Requirements" />
          {storageOutput ? (
            <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 12 }}>
              <ProgressRing label="Bandwidth" value={parseFloat(storageOutput.totalBandwidthMbps.toFixed(1))} max={1000} unit="Mbps" />
              <ProgressRing label="Storage" value={parseFloat(storageOutput.totalStorageTB.toFixed(1))} max={parseFloat(storageOutput.raidAnalysis.usableStorageTB.toFixed(1))} unit="TB" />
              <ProgressRing label="PoE Budget" value={storageOutput.poeBudget.totalWatts} max={storageOutput.poeBudget.recommendedSwitchWatts} unit="W" />
              <ProgressRing label="Drives" value={storageOutput.raidAnalysis.driveCount} max={storageOutput.raidAnalysis.driveCount + 2} unit="disks" />
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 12 }}>
              <ProgressRing label="Cameras" value={counts.cam} max={0} />
              <ProgressRing label="Doors" value={counts.acs} max={0} />
              <ProgressRing label="Network" value={counts.net} max={0} />
              <ProgressRing label="Cable Runs" value={cables.length} max={0} />
            </div>
          )}
          <div style={{ marginTop: 16, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
            <StatRow label="Cable Runs" value={cables.length} />
            <StatRow label="Cable Estimate" value={cableTotal > 0 ? `${cableTotal.toLocaleString()} ft` : '—'} />
          </div>
        </Card>

        {/* Storage Calculator Summary */}
        <Card>
          <SectionTitle icon={HardDrive} label="Storage Calculation" />
          {storageOutput ? (
            <>
              <StatRow label="Cameras Calculated" value={storageOutput.totalCameras} />
              <StatRow label="Total Bandwidth" value={storageOutput.totalBandwidthMbps.toFixed(1)} sub="Mbps" />
              <StatRow label="Daily Storage" value={storageOutput.totalDailyStorageGB.toFixed(1)} sub="GB/day" />
              <StatRow label="30-Day Storage" value={storageOutput.totalStorageTB.toFixed(2)} sub="TB" />
              <StatRow label="RAID Level" value={`RAID ${storageOutput.raidAnalysis.raidLevel}`} />
              <StatRow label="Usable Capacity" value={storageOutput.raidAnalysis.usableStorageTB.toFixed(1)} sub="TB" />
              <StatRow label="Raw Capacity" value={storageOutput.raidAnalysis.rawStorageTB.toFixed(1)} sub="TB" />
              <StatRow label="Drives Required" value={storageOutput.raidAnalysis.driveCount} sub={`x ${storageOutput.raidAnalysis.driveSizeTB} TB`} />
            </>
          ) : (
            <div style={{ padding: '20px 0', textAlign: 'center' }}>
              <HardDrive size={24} color={C.textDim} style={{ margin: '0 auto 8px' }} />
              <p style={{ fontSize: 13, color: C.textDim, margin: 0 }}>No cameras placed yet</p>
              <p style={{ fontSize: 11, color: C.textDim, margin: '4px 0 0' }}>Storage calculation will appear when cameras are added to the canvas</p>
            </div>
          )}
        </Card>

        {/* Risk Factor — arc gauges */}
        <Card>
          <SectionTitle icon={AlertTriangle} label="Risk Factor / Presales" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            <RiskGauge label="Camera Complexity" score={risk.camera} max={30} />
            <RiskGauge label="Door Complexity" score={risk.door} max={30} />
            <RiskGauge label="Pathway Complexity" score={risk.pathway} max={30} />
            <RiskGauge label="Overall Risk" score={risk.overall} max={30} />
          </div>
          <div style={{ marginTop: 12, padding: '8px 12px', background: C.bgPanel, borderRadius: 6 }}>
            <span style={{ fontSize: 11, color: C.textDim }}>
              Risk scoring based on device counts, cable runs, and project complexity. Updates live as the design is built.
            </span>
          </div>
        </Card>

        {/* Licenses (placeholder) */}
        <Card>
          <SectionTitle icon={Shield} label="Licenses" />
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <Shield size={24} color={C.textDim} style={{ margin: '0 auto 8px' }} />
            <p style={{ fontSize: 13, color: C.textDim, margin: 0 }}>License tracking coming soon</p>
            <p style={{ fontSize: 11, color: C.textDim, margin: '4px 0 0' }}>VMS, access control, and software license counts will be displayed here</p>
          </div>
        </Card>

        {/* Survey Files (placeholder) */}
        <Card style={{ gridColumn: '1 / -1' }}>
          <SectionTitle icon={MapPin} label="Survey Files" />
          <div style={{ padding: '12px 0', textAlign: 'center' }}>
            <MapPin size={24} color={C.textDim} style={{ margin: '0 auto 8px' }} />
            <p style={{ fontSize: 13, color: C.textDim, margin: 0 }}>No survey files linked</p>
            <p style={{ fontSize: 11, color: C.textDim, margin: '4px 0 0' }}>Survey files will be linked when the survey module is connected</p>
          </div>
        </Card>

      </div>
    </div>
  )
}
