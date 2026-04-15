'use client'

import { useState, useMemo } from 'react'
import { AlertTriangle, AlertCircle, Info, CheckCircle, Play, Download } from 'lucide-react'
import { C } from './constants'
import { runNetworkChecker, type NetworkCheckerInput, type CheckResult } from '@/lib/calculators/network-checker'
import type { DesignDevice, DesignCable, DesignMdfIdf, DesignTopologyNode, DesignTopologyLink, DesignVlanSubnet } from '@/types/database'

interface Props {
  devices: DesignDevice[]
  cables: DesignCable[]
  mdfIdfs: DesignMdfIdf[]
  topologyNodes: DesignTopologyNode[]
  topologyLinks: DesignTopologyLink[]
  vlans: DesignVlanSubnet[]
}

const SEVERITY_CONFIG: Record<string, { icon: typeof AlertTriangle; color: string; bg: string }> = {
  error: { icon: AlertCircle, color: '#ef4444', bg: 'rgba(239,68,68,0.06)' },
  warning: { icon: AlertTriangle, color: '#f59e0b', bg: 'rgba(245,158,11,0.06)' },
  info: { icon: Info, color: '#3b82f6', bg: 'rgba(59,130,246,0.06)' },
}

export function NetworkCheckerPanel({ devices, cables, mdfIdfs, topologyNodes, topologyLinks, vlans }: Props) {
  const [results, setResults] = useState<CheckResult[] | null>(null)
  const [filterLayer, setFilterLayer] = useState<'all' | 'L1' | 'L2' | 'L3' | 'CMP'>('all')
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'error' | 'warning' | 'info'>('all')

  const runCheck = () => {
    const input: NetworkCheckerInput = {
      devices: devices.map(d => ({ id: d.id, label: d.label || '', category: d.category, properties: (d.properties ?? {}) as Record<string, unknown>, position_x: d.position_x, position_y: d.position_y })),
      cables: cables.map(c => ({ id: c.id, cable_type: c.cable_type || 'cat6', length_ft: c.length_ft || 0, from_device_id: c.from_device_id, to_device_id: c.to_device_id, mdf_idf_id: c.mdf_idf_id })),
      mdfIdfs: mdfIdfs.map(m => ({ id: m.id, name: m.name || 'MDF' })),
      topologyNodes: topologyNodes.map(n => ({ id: n.id, node_type: n.node_type, label: n.label || '', properties: (n.properties ?? {}) as Record<string, unknown> })),
      topologyLinks: topologyLinks.map(l => ({ id: l.id, from_node_id: l.from_node_id, to_node_id: l.to_node_id, link_type: l.cable_type || '', properties: {} })),
      vlans: vlans.map(v => ({ id: v.id, vlan_id: v.vlan_id || 0, name: v.vlan_name || '', subnet: v.subnet || '', gateway: v.gateway || '' })),
    }
    const output = runNetworkChecker(input)
    setResults(output.results)
  }

  const filtered = useMemo(() => {
    if (!results) return []
    return results.filter(r =>
      (filterLayer === 'all' || r.layer === filterLayer) &&
      (filterSeverity === 'all' || r.severity === filterSeverity)
    )
  }, [results, filterLayer, filterSeverity])

  const summary = useMemo(() => {
    if (!results) return null
    return {
      errors: results.filter(r => r.severity === 'error').length,
      warnings: results.filter(r => r.severity === 'warning').length,
      info: results.filter(r => r.severity === 'info').length,
    }
  }, [results])

  const exportResults = () => {
    if (!results) return
    import('@/lib/export-helpers').then(async m => {
      const columns = ['ID', 'Layer', 'Severity', 'Check', 'Message', 'Device']
      const rows = results.map(r => ({ ID: r.id, Layer: r.layer, Severity: r.severity, Check: r.check, Message: r.message, Device: r.deviceLabel || '' }))
      // Use the internal exportInFormat — but it's not exported. Use toPdfPrint pattern instead.
      const title = 'Network Checker Results'
      const headerCells = columns.map(c => `<th style="border:1px solid #ddd;padding:6px;background:#f5f5f5;font-size:11px;font-weight:600">${c}</th>`).join('')
      const bodyRows = rows.map(r => `<tr><td style="border:1px solid #ddd;padding:5px;font-size:10px;font-family:monospace">${r.ID}</td><td style="border:1px solid #ddd;padding:5px;font-size:10px">${r.Layer}</td><td style="border:1px solid #ddd;padding:5px;font-size:10px;color:${r.Severity === 'error' ? '#ef4444' : r.Severity === 'warning' ? '#f59e0b' : '#3b82f6'};font-weight:600">${r.Severity.toUpperCase()}</td><td style="border:1px solid #ddd;padding:5px;font-size:10px">${r.Check}</td><td style="border:1px solid #ddd;padding:5px;font-size:10px">${r.Message}</td><td style="border:1px solid #ddd;padding:5px;font-size:10px">${r.Device}</td></tr>`).join('')
      const html = `<!DOCTYPE html><html><head><title>${title}</title><style>body{font-family:system-ui;max-width:1000px;margin:30px auto;padding:0 20px}h1{font-size:18px;color:#522F82;border-bottom:2px solid #522F82;padding-bottom:6px}table{width:100%;border-collapse:collapse;margin:12px 0}.summary{display:flex;gap:16px;margin:12px 0}.badge{padding:4px 12px;border-radius:4px;font-size:12px;font-weight:600}</style></head><body><h1>${title}</h1><div class="summary"><span class="badge" style="background:rgba(239,68,68,0.1);color:#ef4444">${summary?.errors} Errors</span><span class="badge" style="background:rgba(245,158,11,0.1);color:#f59e0b">${summary?.warnings} Warnings</span><span class="badge" style="background:rgba(59,130,246,0.1);color:#3b82f6">${summary?.info} Info</span></div><table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table></body></html>`
      const w = window.open('', '_blank', 'width=900,height=700')
      if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500) }
    })
  }

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Network Checker</div>
          <div style={{ fontSize: 11, color: C.textDim }}>Physical (L1) + Logical (L2/L3) validation</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {results && (
            <button onClick={exportResults} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 14px', background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 11, fontWeight: 600, color: C.text, cursor: 'pointer', fontFamily: 'inherit' }}>
              <Download size={13} /> Export PDF
            </button>
          )}
          <button onClick={runCheck} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 14px', background: C.accent, color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Play size={13} /> Run Checks
          </button>
        </div>
      </div>

      {!results ? (
        <div style={{ padding: 40, textAlign: 'center', background: C.bgPanel, borderRadius: 8, border: `1px solid ${C.border}` }}>
          <CheckCircle size={32} style={{ color: C.textDim, margin: '0 auto 12px' }} />
          <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>Ready to validate</div>
          <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>
            Click &ldquo;Run Checks&rdquo; to validate {devices.length} devices, {cables.length} cables, {vlans.length} VLANs
          </div>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {summary && (['error', 'warning', 'info'] as const).map(s => {
              const cfg = SEVERITY_CONFIG[s]
              const count = s === 'error' ? summary.errors : s === 'warning' ? summary.warnings : summary.info
              return (
                <button key={s} onClick={() => setFilterSeverity(filterSeverity === s ? 'all' : s)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: filterSeverity === s ? cfg.bg : C.bgPanel, border: `1px solid ${filterSeverity === s ? cfg.color + '40' : C.border}`, borderRadius: 6, fontSize: 11, fontWeight: 700, color: cfg.color, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {count} {s}{count !== 1 ? 's' : ''}
                </button>
              )
            })}
            <div style={{ flex: 1 }} />
            {(['L1', 'L2', 'L3', 'CMP'] as const).map(l => (
              <button key={l} onClick={() => setFilterLayer(filterLayer === l ? 'all' : l)}
                style={{ padding: '4px 10px', fontSize: 10, fontWeight: 600, background: filterLayer === l ? `${C.accent}15` : 'transparent', border: `1px solid ${filterLayer === l ? C.accent : C.border}`, borderRadius: 4, color: filterLayer === l ? C.accent : C.textMuted, cursor: 'pointer', fontFamily: 'inherit' }}>
                {l}
              </button>
            ))}
          </div>

          {/* Results list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', background: 'rgba(34,197,94,0.05)', borderRadius: 8, border: '1px solid rgba(34,197,94,0.2)' }}>
                <CheckCircle size={20} style={{ color: '#22c55e', margin: '0 auto 8px' }} />
                <div style={{ fontSize: 12, fontWeight: 600, color: '#22c55e' }}>All checks passed!</div>
              </div>
            ) : filtered.map(r => {
              const cfg = SEVERITY_CONFIG[r.severity]
              const Icon = cfg.icon
              return (
                <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 12px', background: cfg.bg, borderRadius: 6, border: `1px solid ${cfg.color}20` }}>
                  <Icon size={14} style={{ color: cfg.color, flexShrink: 0, marginTop: 1 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 8, fontWeight: 700, color: C.textDim, fontFamily: 'monospace' }}>{r.id}</span>
                      <span style={{ fontSize: 8, fontWeight: 600, color: C.accent, padding: '0 4px', background: `${C.accent}10`, borderRadius: 2 }}>{r.layer}</span>
                      <span style={{ fontSize: 9, fontWeight: 600, color: C.text }}>{r.check}</span>
                    </div>
                    <div style={{ fontSize: 10, color: C.textMuted }}>{r.message}</div>
                    {r.deviceLabel && <div style={{ fontSize: 8, color: C.textDim, marginTop: 2 }}>Device: {r.deviceLabel}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
