'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { List, LayoutGrid } from 'lucide-react'
import { C } from './constants'
import type { DesignTopologyNode, DesignTopologyLink } from '@/types/database'

interface TopologyViewProps {
  designId: string
  nodes: DesignTopologyNode[]
  links: DesignTopologyLink[]
  onAddNode: (data: Record<string, unknown>) => Promise<unknown>
  onUpdateNode: (id: string, data: Record<string, unknown>) => Promise<unknown>
  onDeleteNode: (id: string) => Promise<unknown>
  onAddLink: (data: Record<string, unknown>) => Promise<unknown>
  onUpdateLink: (id: string, data: Record<string, unknown>) => Promise<unknown>
  onDeleteLink: (id: string) => Promise<unknown>
}

const NODE_COLORS: Record<string, string> = {
  switch: '#8b5cf6', router: '#3b82f6', firewall: '#ef4444', server: '#6366f1',
  nvr: '#14b8a6', wireless_ap: '#22c55e', camera: '#06b6d4', acs_controller: '#f97316', endpoint: '#64748b',
}
const NODE_TYPES = ['switch', 'router', 'firewall', 'server', 'nvr', 'wireless_ap', 'camera', 'acs_controller', 'endpoint']
const NODE_LABELS: Record<string, string> = {
  switch: 'Switch', router: 'Router', firewall: 'Firewall', server: 'Server',
  nvr: 'NVR', wireless_ap: 'Wireless AP', camera: 'Camera', acs_controller: 'ACS Controller', endpoint: 'Endpoint',
}
const LAYERS = ['physical', 'data_link', 'network'] as const
const LAYER_LABELS: Record<string, string> = { physical: 'L1 Physical', data_link: 'L2 Data Link', network: 'L3 Network' }
const SPEED_OPTIONS = ['10M', '100M', '1G', '2.5G', '5G', '10G', '25G', '40G', '100G']
const CABLE_TYPES = ['cat5e', 'cat6', 'cat6a', 'fiber_sm', 'fiber_mm', 'coax', 'wireless']

const NODE_W = 64
const NODE_H = 44

function NodeShape({ type, color, selected }: { type: string; color: string; selected: boolean }) {
  const stroke = selected ? '#fff' : color
  const sw = selected ? 2.5 : 2
  const fill = C.bgPanel
  switch (type) {
    case 'router':
      return <circle cx={0} cy={0} r={22} fill={fill} stroke={stroke} strokeWidth={sw} />
    case 'firewall':
      return <polygon points="0,-24 22,12 -22,12" fill={fill} stroke={stroke} strokeWidth={sw} />
    case 'wireless_ap':
      return <ellipse cx={0} cy={0} rx={28} ry={18} fill={fill} stroke={stroke} strokeWidth={sw} />
    default:
      return <rect x={-NODE_W / 2} y={-NODE_H / 2} width={NODE_W} height={NODE_H} rx={6} fill={fill} stroke={stroke} strokeWidth={sw} />
  }
}

/** Speed string to Mbps for bandwidth utilization coloring */
function speedToMbps(s: string | null | undefined): number {
  if (!s) return 1000
  const map: Record<string, number> = { '10M': 10, '100M': 100, '1G': 1000, '2.5G': 2500, '5G': 5000, '10G': 10000, '25G': 25000, '40G': 40000, '100G': 100000 }
  return map[s] ?? 1000
}

/** Bandwidth utilization color: green <50%, yellow 50-80%, red >80% */
function bwColor(utilPct: number): string {
  if (utilPct >= 80) return C.red
  if (utilPct >= 50) return C.yellow
  return C.green
}

const inputStyle: React.CSSProperties = {
  background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3,
  padding: '2px 6px', color: C.text, fontSize: 11, outline: 'none', width: '100%',
}
const selectStyle: React.CSSProperties = { ...inputStyle, appearance: 'auto' as never }
const labelStyle: React.CSSProperties = { fontSize: 9, color: C.textDim, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 2 }

export function TopologyView({ designId, nodes, links, onAddNode, onUpdateNode, onDeleteNode, onAddLink, onUpdateLink, onDeleteLink }: TopologyViewProps) {
  const [activeLayer, setActiveLayer] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null)
  const [linkMode, setLinkMode] = useState(false)
  const [linkSourceId, setLinkSourceId] = useState<string | null>(null)
  const [dragNode, setDragNode] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [addType, setAddType] = useState('switch')
  const [showConnectionsList, setShowConnectionsList] = useState(false)
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 1200, h: 700 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0, vx: 0, vy: 0 })
  const svgRef = useRef<SVGSVGElement>(null)

  const filteredNodes = activeLayer ? nodes.filter((n) => n.layer === activeLayer) : nodes
  const filteredLinks = links.filter((l) => {
    const src = nodes.find((n) => n.id === l.from_node_id)
    const tgt = nodes.find((n) => n.id === l.to_node_id)
    if (!src || !tgt) return false
    if (!activeLayer) return true
    return src.layer === activeLayer || tgt.layer === activeLayer
  })

  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) ?? null : null
  const selectedLink = selectedLinkId ? links.find((l) => l.id === selectedLinkId) ?? null : null

  // Port count per node
  const portCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const l of links) {
      map.set(l.from_node_id, (map.get(l.from_node_id) ?? 0) + 1)
      map.set(l.to_node_id, (map.get(l.to_node_id) ?? 0) + 1)
    }
    return map
  }, [links])

  /* ---- Drag ---- */
  const handleMouseDown = (nodeId: string, e: React.MouseEvent) => {
    if (linkMode) return
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return
    setDragNode(nodeId)
    const svg = svgRef.current
    if (!svg) return
    const pt = svg.getBoundingClientRect()
    const scaleX = viewBox.w / pt.width
    const scaleY = viewBox.h / pt.height
    setDragOffset({
      x: (e.clientX - pt.left) * scaleX + viewBox.x - node.position_x,
      y: (e.clientY - pt.top) * scaleY + viewBox.y - node.position_y,
    })
  }
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragNode) return
    const svg = svgRef.current
    if (!svg) return
    const pt = svg.getBoundingClientRect()
    const scaleX = viewBox.w / pt.width
    const scaleY = viewBox.h / pt.height
    onUpdateNode(dragNode, {
      position_x: Math.round((e.clientX - pt.left) * scaleX + viewBox.x - dragOffset.x),
      position_y: Math.round((e.clientY - pt.top) * scaleY + viewBox.y - dragOffset.y),
    })
  }, [dragNode, dragOffset, onUpdateNode, viewBox])
  const handleMouseUp = useCallback(() => { setDragNode(null) }, [])

  useEffect(() => {
    if (!dragNode) return
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp) }
  }, [dragNode, handleMouseMove, handleMouseUp])

  /* ---- Pan/Zoom ---- */
  const handleSvgMouseDown = (e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as SVGElement).tagName === 'rect') {
      if (!linkMode) {
        setSelectedNodeId(null)
        setSelectedLinkId(null)
      }
      // Middle click or space held — pan
      if (e.button === 1 || e.button === 0) {
        setIsPanning(true)
        setPanStart({ x: e.clientX, y: e.clientY, vx: viewBox.x, vy: viewBox.y })
      }
    }
  }
  useEffect(() => {
    if (!isPanning) return
    function onMove(e: MouseEvent) {
      const svg = svgRef.current
      if (!svg) return
      const pt = svg.getBoundingClientRect()
      const scaleX = viewBox.w / pt.width
      const scaleY = viewBox.h / pt.height
      setViewBox(prev => ({
        ...prev,
        x: panStart.vx - (e.clientX - panStart.x) * scaleX,
        y: panStart.vy - (e.clientY - panStart.y) * scaleY,
      }))
    }
    function onUp() { setIsPanning(false) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [isPanning, panStart, viewBox.w, viewBox.h])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 1.1 : 0.9
    setViewBox(prev => {
      const nw = prev.w * factor
      const nh = prev.h * factor
      return { x: prev.x - (nw - prev.w) / 2, y: prev.y - (nh - prev.h) / 2, w: nw, h: nh }
    })
  }, [])

  /* ---- Node click ---- */
  const handleNodeClick = (nodeId: string) => {
    if (linkMode) {
      if (!linkSourceId) {
        setLinkSourceId(nodeId)
      } else if (linkSourceId !== nodeId) {
        onAddLink({ from_node_id: linkSourceId, to_node_id: nodeId, cable_type: 'cat6', speed: '1G', is_trunk: false })
        setLinkSourceId(null)
        setLinkMode(false)
      }
      return
    }
    setSelectedNodeId(nodeId)
    setSelectedLinkId(null)
  }
  const handleLinkClick = (linkId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedLinkId(linkId)
    setSelectedNodeId(null)
  }
  const handleDeleteNode = async (nodeId: string) => {
    const orphanLinks = links.filter((l) => l.from_node_id === nodeId || l.to_node_id === nodeId)
    for (const l of orphanLinks) { await onDeleteLink(l.id) }
    await onDeleteNode(nodeId)
    setSelectedNodeId(null)
  }

  const handleAddNode = () => {
    const prefix = NODE_LABELS[addType]?.substring(0, 3).toUpperCase() ?? 'NOD'
    const count = nodes.filter((n) => n.node_type === addType).length + 1
    onAddNode({
      node_type: addType,
      label: `${prefix}-${count}`,
      position_x: viewBox.x + viewBox.w / 2 + (Math.random() - 0.5) * 200,
      position_y: viewBox.y + viewBox.h / 2 + (Math.random() - 0.5) * 150,
      layer: activeLayer ?? 'data_link',
      properties: {},
    })
  }

  /* ---- Simple tree auto-layout ---- */
  const handleAutoLayout = () => {
    if (nodes.length === 0) return
    // Find root(s): nodes with no incoming links
    const hasIncoming = new Set(links.map(l => l.to_node_id))
    const roots = nodes.filter(n => !hasIncoming.has(n.id))
    const startNodes = roots.length > 0 ? roots : [nodes[0]]

    const visited = new Set<string>()
    const queue: Array<{ id: string; depth: number; idx: number }> = []
    const depthMap = new Map<number, number>()

    for (let i = 0; i < startNodes.length; i++) {
      queue.push({ id: startNodes[i].id, depth: 0, idx: i })
    }

    const positions: Array<{ id: string; x: number; y: number }> = []
    while (queue.length > 0) {
      const { id, depth } = queue.shift()!
      if (visited.has(id)) continue
      visited.add(id)

      const col = depthMap.get(depth) ?? 0
      depthMap.set(depth, col + 1)
      positions.push({ id, x: 120 + depth * 180, y: 80 + col * 90 })

      const children = links.filter(l => l.from_node_id === id).map(l => l.to_node_id)
        .concat(links.filter(l => l.to_node_id === id).map(l => l.from_node_id))
        .filter(cid => !visited.has(cid))
      for (const cid of children) {
        queue.push({ id: cid, depth: depth + 1, idx: 0 })
      }
    }

    // Place unvisited nodes
    let extraIdx = 0
    for (const n of nodes) {
      if (!visited.has(n.id)) {
        positions.push({ id: n.id, x: 120 + extraIdx * 100, y: 500 })
        extraIdx++
      }
    }

    for (const p of positions) {
      onUpdateNode(p.id, { position_x: p.x, position_y: p.y })
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.bg, overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 6, padding: '8px 12px', borderBottom: `1px solid ${C.border}`, flexShrink: 0, alignItems: 'center' }}>
        <button onClick={() => setActiveLayer(null)} style={{ padding: '3px 8px', fontSize: 10, fontWeight: 600, borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit', background: !activeLayer ? C.accentSubtle : C.bgActive, color: !activeLayer ? C.accent : C.textDim, border: !activeLayer ? `1px solid ${C.accent}` : `1px solid ${C.border}` }}>All</button>
        {LAYERS.map((l) => (
          <button key={l} onClick={() => setActiveLayer(l)} style={{ padding: '3px 8px', fontSize: 10, fontWeight: 600, borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit', background: activeLayer === l ? C.accentSubtle : C.bgActive, color: activeLayer === l ? C.accent : C.textDim, border: activeLayer === l ? `1px solid ${C.accent}` : `1px solid ${C.border}` }}>{LAYER_LABELS[l]}</button>
        ))}
        <div style={{ width: 1, height: 16, background: C.border, margin: '0 4px' }} />
        <button onClick={() => { setLinkMode(!linkMode); setLinkSourceId(null) }}
          style={{ padding: '3px 8px', fontSize: 10, fontWeight: 600, borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
            background: linkMode ? 'rgba(34,197,94,0.15)' : C.bgActive, color: linkMode ? C.green : C.textDim,
            border: linkMode ? `1px solid ${C.green}` : `1px solid ${C.border}` }}>
          {linkMode ? (linkSourceId ? 'Click Target...' : 'Click Source...') : 'Link Mode'}
        </button>
        <button onClick={handleAutoLayout} style={{ padding: '3px 8px', fontSize: 10, fontWeight: 500, borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit', background: C.bgActive, color: C.textDim, border: `1px solid ${C.border}` }} title="Auto-arrange nodes">
          <LayoutGrid size={11} style={{ marginRight: 3 }} /> Auto
        </button>
        <button onClick={() => setShowConnectionsList(!showConnectionsList)} style={{ padding: '3px 8px', fontSize: 10, fontWeight: 500, borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit', background: showConnectionsList ? C.accentSubtle : C.bgActive, color: showConnectionsList ? C.accent : C.textDim, border: showConnectionsList ? `1px solid ${C.accent}` : `1px solid ${C.border}` }} title="Connections list">
          <List size={11} />
        </button>
        <div style={{ flex: 1 }} />
        <select value={addType} onChange={(e) => setAddType(e.target.value)}
          style={{ padding: '3px 6px', fontSize: 10, borderRadius: 4, background: C.bgActive, color: C.text, border: `1px solid ${C.border}`, outline: 'none', fontFamily: 'inherit' }}>
          {NODE_TYPES.map((t) => <option key={t} value={t}>{NODE_LABELS[t]}</option>)}
        </select>
        <button onClick={handleAddNode} style={{ padding: '3px 10px', fontSize: 10, fontWeight: 500, borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit', background: C.accent, color: '#fff', border: 'none' }}>+ Add Node</button>
        <span style={{ fontSize: 10, color: C.textDim }}>{filteredNodes.length}N / {filteredLinks.length}L</span>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Connections list panel */}
        {showConnectionsList && (
          <div style={{ width: 280, borderRight: `1px solid ${C.border}`, background: C.bgPanel, overflow: 'auto', flexShrink: 0, padding: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: C.textDim, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              Connections ({filteredLinks.length})
            </div>
            {filteredLinks.length === 0 && (
              <div style={{ fontSize: 11, color: C.textDim, padding: 12, textAlign: 'center' }}>No connections</div>
            )}
            {filteredLinks.map((link) => {
              const src = nodes.find(n => n.id === link.from_node_id)
              const tgt = nodes.find(n => n.id === link.to_node_id)
              const isSel = link.id === selectedLinkId
              return (
                <div key={link.id}
                  onClick={() => { setSelectedLinkId(link.id); setSelectedNodeId(null) }}
                  style={{
                    padding: '6px 8px', borderRadius: 4, marginBottom: 2, cursor: 'pointer',
                    background: isSel ? C.accentSubtle : 'transparent',
                    border: isSel ? `1px solid ${C.accent}` : '1px solid transparent',
                  }}
                  onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = C.bgHover }}
                  onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ fontSize: 11, color: C.text, fontWeight: 500 }}>
                    {src?.label ?? '?'} → {tgt?.label ?? '?'}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                    {link.cable_type && <span style={{ fontSize: 9, color: C.textDim }}>{link.cable_type}</span>}
                    {link.speed && <span style={{ fontSize: 9, color: C.textMuted, fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace" }}>{link.speed}</span>}
                    {link.is_trunk && <span style={{ fontSize: 8, padding: '0 4px', borderRadius: 2, background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', fontWeight: 600 }}>TRUNK</span>}
                    {!!(link as unknown as Record<string, unknown>).vlan && <span style={{ fontSize: 8, padding: '0 4px', borderRadius: 2, background: 'rgba(34,197,94,0.15)', color: C.green, fontWeight: 600 }}>VLAN {String((link as unknown as Record<string, unknown>).vlan)}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* SVG Canvas with pan/zoom */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <svg ref={svgRef}
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
            width="100%" height="100%"
            style={{ cursor: isPanning ? 'grabbing' : linkMode ? 'crosshair' : 'default' }}
            onMouseDown={handleSvgMouseDown}
            onWheel={handleWheel}>
            {/* Grid */}
            <defs>
              <pattern id="topo-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <circle cx="20" cy="20" r="0.5" fill={C.borderSubtle} />
              </pattern>
            </defs>
            <rect x={viewBox.x} y={viewBox.y} width={viewBox.w} height={viewBox.h} fill="url(#topo-grid)" />

            {/* Links with bandwidth color */}
            {filteredLinks.map((link) => {
              const src = nodes.find((n) => n.id === link.from_node_id)
              const tgt = nodes.find((n) => n.id === link.to_node_id)
              if (!src || !tgt) return null
              const midX = (src.position_x + tgt.position_x) / 2
              const midY = (src.position_y + tgt.position_y) / 2
              const isSel = link.id === selectedLinkId
              // Bandwidth utilization color (from notes field "bw:XX" or default green)
              const bwNote = (link.notes ?? '').match(/bw:(\d+)/i)
              const utilPct = bwNote ? (parseInt(bwNote[1]) / speedToMbps(link.speed)) * 100 : 0
              const lineColor = isSel ? '#fff' : utilPct > 0 ? bwColor(utilPct) : C.textDim

              return (
                <g key={link.id} onClick={(e) => handleLinkClick(link.id, e)} style={{ cursor: 'pointer' }}>
                  <line x1={src.position_x} y1={src.position_y} x2={tgt.position_x} y2={tgt.position_y} stroke="transparent" strokeWidth={12} />
                  <line x1={src.position_x} y1={src.position_y} x2={tgt.position_x} y2={tgt.position_y}
                    stroke={lineColor} strokeWidth={isSel ? 2.5 : link.is_trunk ? 2 : 1.5}
                    strokeDasharray={link.is_trunk ? 'none' : '6 3'} />
                  {link.speed && (
                    <text x={midX} y={midY - 6} textAnchor="middle" fill={isSel ? '#fff' : C.textMuted} fontSize={9} fontFamily="'SF Mono', 'Cascadia Code', 'Consolas', monospace">{link.speed}</text>
                  )}
                  {link.cable_type && (
                    <text x={midX} y={midY + 10} textAnchor="middle" fill={C.textDim} fontSize={8} fontFamily="'SF Mono', 'Cascadia Code', 'Consolas', monospace">{link.cable_type}</text>
                  )}
                  {/* VLAN tag */}
                  {!!(link as unknown as Record<string, unknown>).vlan && (
                    <g transform={`translate(${midX + 30}, ${midY - 6})`}>
                      <rect x={-14} y={-7} width={28} height={14} rx={3} fill="rgba(34,197,94,0.2)" />
                      <text x={0} y={3} textAnchor="middle" fill={C.green} fontSize={7} fontWeight={600}>V{String((link as unknown as Record<string, unknown>).vlan)}</text>
                    </g>
                  )}
                </g>
              )
            })}

            {/* Link-in-progress */}
            {linkMode && linkSourceId && (() => {
              const src = nodes.find((n) => n.id === linkSourceId)
              if (!src) return null
              return <circle cx={src.position_x} cy={src.position_y} r={28} fill="none" stroke={C.green} strokeWidth={2} strokeDasharray="4 3" />
            })()}

            {/* Nodes with port badges */}
            {filteredNodes.map((node) => {
              const color = NODE_COLORS[node.node_type ?? 'endpoint'] || C.textMuted
              const isSel = node.id === selectedNodeId
              const isLinkSrc = node.id === linkSourceId
              const ports = portCounts.get(node.id) ?? 0
              return (
                <g key={node.id}
                  transform={`translate(${node.position_x}, ${node.position_y})`}
                  onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(node.id, e) }}
                  onClick={(e) => { e.stopPropagation(); handleNodeClick(node.id) }}
                  style={{ cursor: linkMode ? 'crosshair' : dragNode === node.id ? 'grabbing' : 'grab' }}>
                  <NodeShape type={node.node_type} color={color} selected={isSel || isLinkSrc} />
                  <text x={0} y={3} textAnchor="middle" fill={C.text} fontSize={10} fontWeight={600} fontFamily="'Inter', 'Segoe UI', sans-serif" pointerEvents="none">{node.label}</text>
                  <text x={0} y={NODE_H / 2 + 12} textAnchor="middle" fill={C.textDim} fontSize={8} fontFamily="'SF Mono', 'Cascadia Code', 'Consolas', monospace" pointerEvents="none">{NODE_LABELS[node.node_type] ?? node.node_type}</text>
                  {/* Port count badge */}
                  {ports > 0 && (
                    <g transform={`translate(${NODE_W / 2 - 4}, ${-NODE_H / 2 - 4})`}>
                      <circle r={8} fill={C.bgPanel} stroke={color} strokeWidth={1.5} />
                      <text x={0} y={3} textAnchor="middle" fill={color} fontSize={8} fontWeight={700} fontFamily="'SF Mono', 'Cascadia Code', 'Consolas', monospace">{ports}</text>
                    </g>
                  )}
                </g>
              )
            })}
          </svg>
        </div>

        {/* Property Panel */}
        {(selectedNode || selectedLink) && (
          <div style={{ width: 240, borderLeft: `1px solid ${C.border}`, background: C.bgPanel, overflow: 'auto', flexShrink: 0 }}>
            {selectedNode && (
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>Node Properties</span>
                  <button onClick={() => setSelectedNodeId(null)} style={{ fontSize: 10, color: C.textDim, background: 'none', border: 'none', cursor: 'pointer' }}>x</button>
                </div>
                <div>
                  <div style={labelStyle}>Label</div>
                  <input defaultValue={selectedNode.label} style={inputStyle}
                    onBlur={(e) => onUpdateNode(selectedNode.id, { label: e.target.value })} />
                </div>
                <div>
                  <div style={labelStyle}>Type</div>
                  <select defaultValue={selectedNode.node_type} style={selectStyle}
                    onChange={(e) => onUpdateNode(selectedNode.id, { node_type: e.target.value })}>
                    {NODE_TYPES.map((t) => <option key={t} value={t}>{NODE_LABELS[t]}</option>)}
                  </select>
                </div>
                <div>
                  <div style={labelStyle}>Layer</div>
                  <select defaultValue={selectedNode.layer} style={selectStyle}
                    onChange={(e) => onUpdateNode(selectedNode.id, { layer: e.target.value })}>
                    {LAYERS.map((l) => <option key={l} value={l}>{LAYER_LABELS[l]}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={labelStyle}>X</div>
                    <input type="number" defaultValue={selectedNode.position_x} style={{ ...inputStyle, fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace" }}
                      onBlur={(e) => onUpdateNode(selectedNode.id, { position_x: Number(e.target.value) })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={labelStyle}>Y</div>
                    <input type="number" defaultValue={selectedNode.position_y} style={{ ...inputStyle, fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace" }}
                      onBlur={(e) => onUpdateNode(selectedNode.id, { position_y: Number(e.target.value) })} />
                  </div>
                </div>
                <div style={{ fontSize: 10, color: C.textDim }}>
                  {portCounts.get(selectedNode.id) ?? 0} connection(s)
                </div>
                <button onClick={() => handleDeleteNode(selectedNode.id)}
                  style={{ padding: '4px 0', fontSize: 10, color: C.red, background: 'transparent', border: `1px solid ${C.red}`, borderRadius: 4, cursor: 'pointer' }}>
                  Delete Node
                </button>
              </div>
            )}
            {selectedLink && (
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>Link Properties</span>
                  <button onClick={() => setSelectedLinkId(null)} style={{ fontSize: 10, color: C.textDim, background: 'none', border: 'none', cursor: 'pointer' }}>x</button>
                </div>
                <div style={{ fontSize: 10, color: C.textDim }}>
                  {nodes.find((n) => n.id === selectedLink.from_node_id)?.label ?? '?'} → {nodes.find((n) => n.id === selectedLink.to_node_id)?.label ?? '?'}
                </div>
                <div>
                  <div style={labelStyle}>Cable Type</div>
                  <select defaultValue={selectedLink.cable_type ?? ''} style={selectStyle}
                    onChange={(e) => onUpdateLink(selectedLink.id, { cable_type: e.target.value || null })}>
                    <option value="">None</option>
                    {CABLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <div style={labelStyle}>Speed</div>
                  <select defaultValue={selectedLink.speed ?? ''} style={selectStyle}
                    onChange={(e) => onUpdateLink(selectedLink.id, { speed: e.target.value || null })}>
                    <option value="">—</option>
                    {SPEED_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <div style={labelStyle}>Trunk</div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.text, cursor: 'pointer' }}>
                    <input type="checkbox" defaultChecked={selectedLink.is_trunk}
                      onChange={(e) => onUpdateLink(selectedLink.id, { is_trunk: e.target.checked })} />
                    802.1Q Trunk
                  </label>
                </div>
                <div>
                  <div style={labelStyle}>Notes</div>
                  <input defaultValue={selectedLink.notes ?? ''} style={inputStyle} placeholder="bw:500 for 500Mbps util"
                    onBlur={(e) => onUpdateLink(selectedLink.id, { notes: e.target.value || null })} />
                </div>
                <button onClick={() => { onDeleteLink(selectedLink.id); setSelectedLinkId(null) }}
                  style={{ padding: '4px 0', fontSize: 10, color: C.red, background: 'transparent', border: `1px solid ${C.red}`, borderRadius: 4, cursor: 'pointer' }}>
                  Delete Link
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
