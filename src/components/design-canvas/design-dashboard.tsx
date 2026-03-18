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

// --- Reusable sub-components (inline-styled, C tokens) ---

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

function DeviceBar({ label, count, total, color, icon: Icon }: { label: string; count: number; total: number; color: string; icon: React.ElementType }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
      <Icon size={14} color={color} style={{ flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: C.textMuted, width: 100, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: C.bgHover, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: C.text, width: 36, textAlign: 'right' }}>{count}</span>
    </div>
  )
}

function RiskGauge({ label, score, max }: { label: string; score: number; max: number }) {
  const pct = max > 0 ? Math.min((score / max) * 100, 100) : 0
  const color = pct < 33 ? C.green : pct < 66 ? C.yellow : C.red
  const riskLabel = pct < 33 ? 'Low' : pct < 66 ? 'Medium' : 'High'
  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: C.textMuted }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color }}>{riskLabel}</span>
      </div>
      <div style={{ height: 4, background: C.bgHover, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2 }} />
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

  // Fetch design + devices + cables
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

  // Device category counts
  const counts = useMemo(() => {
    const cam = devices.filter(d => CAMERA_TYPES.includes(d.category)).length
    const acs = devices.filter(d => ACS_TYPES.includes(d.category)).length
    const net = devices.filter(d => NETWORK_TYPES.includes(d.category)).length
    const av = devices.filter(d => AV_TYPES.includes(d.category)).length
    const vape = devices.filter(d => VAPE_ENV_TYPES.includes(d.category)).length
    const other = devices.length - cam - acs - net - av - vape
    return { cam, acs, net, av, vape, other, total: devices.length }
  }, [devices])

  // Storage calc
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

  // Cable total
  const cableTotal = useMemo(() => cables.reduce((s, c) => s + (c.total_length_ft ?? 0), 0), [cables])

  // Risk factor scoring
  const risk = useMemo(() => {
    // Camera complexity: 0-10 cameras = low, 11-50 = med, 50+ = high
    const camScore = counts.cam <= 10 ? counts.cam : counts.cam <= 50 ? 10 + (counts.cam - 10) * 0.5 : 30 + (counts.cam - 50) * 0.3
    // Door complexity: 0-5 = low, 6-20 = med, 20+ = high
    const doorScore = counts.acs <= 5 ? counts.acs : counts.acs <= 20 ? 5 + (counts.acs - 5) * 0.8 : 17 + (counts.acs - 20) * 0.5
    // Pathway: cable run complexity
    const pathScore = cableTotal <= 1000 ? cableTotal / 100 : cableTotal <= 5000 ? 10 + (cableTotal - 1000) / 400 : 20 + (cableTotal - 5000) / 1000
    // Overall
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

        {/* Device Summary */}
        <Card>
          <SectionTitle icon={Package} label="Device Summary" />
          <DeviceBar label="Cameras" count={counts.cam} total={counts.total} color="#3b82f6" icon={Camera} />
          <DeviceBar label="Access Control" count={counts.acs} total={counts.total} color="#f97316" icon={DoorOpen} />
          <DeviceBar label="Network" count={counts.net} total={counts.total} color="#22c55e" icon={Wifi} />
          <DeviceBar label="AV" count={counts.av} total={counts.total} color="#8b5cf6" icon={Speaker} />
          <DeviceBar label="Vape/Env" count={counts.vape} total={counts.total} color="#ef4444" icon={Wind} />
          {counts.other > 0 && (
            <DeviceBar label="Other" count={counts.other} total={counts.total} color={C.textDim} icon={Package} />
          )}
          <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.textMuted }}>Total Devices</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{counts.total}</span>
          </div>
        </Card>

        {/* Project Requirements */}
        <Card>
          <SectionTitle icon={Gauge} label="Project Requirements" />
          <StatRow label="Total Cameras" value={counts.cam} />
          <StatRow label="Total Doors" value={counts.acs} />
          <StatRow label="Network Devices" value={counts.net} />
          <StatRow label="Cable Runs" value={cables.length} />
          <StatRow label="Cable Estimate" value={cableTotal > 0 ? `${cableTotal.toLocaleString()} ft` : '—'} />
          {storageOutput && (
            <>
              <StatRow label="Bandwidth" value={storageOutput.totalBandwidthMbps.toFixed(1)} sub="Mbps" />
              <StatRow label="PoE Budget" value={storageOutput.poeBudget.totalWatts} sub="W" />
              <StatRow label="Switch Capacity" value={storageOutput.poeBudget.recommendedSwitchWatts} sub="W" />
            </>
          )}
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
              <StatRow label="Drives Required" value={storageOutput.raidAnalysis.driveCount} sub={`× ${storageOutput.raidAnalysis.driveSizeTB} TB`} />
            </>
          ) : (
            <div style={{ padding: '20px 0', textAlign: 'center' }}>
              <HardDrive size={24} color={C.textDim} style={{ margin: '0 auto 8px' }} />
              <p style={{ fontSize: 13, color: C.textDim, margin: 0 }}>No cameras placed yet</p>
              <p style={{ fontSize: 11, color: C.textDim, margin: '4px 0 0' }}>Storage calculation will appear when cameras are added to the canvas</p>
            </div>
          )}
        </Card>

        {/* Risk Factor */}
        <Card>
          <SectionTitle icon={AlertTriangle} label="Risk Factor / Presales" />
          <RiskGauge label="Camera Complexity" score={risk.camera} max={30} />
          <RiskGauge label="Door Complexity" score={risk.door} max={30} />
          <RiskGauge label="Pathway Complexity" score={risk.pathway} max={30} />
          <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 8, paddingTop: 8 }}>
            <RiskGauge label="Overall Project Risk" score={risk.overall} max={30} />
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
