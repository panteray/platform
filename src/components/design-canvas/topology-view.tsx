'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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

/* Node shape paths centered at (0,0) — translated via transform */
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

  /* ---- Drag ---- */
  const handleMouseDown = (nodeId: string, e: React.MouseEvent) => {
    if (linkMode) return
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return
    setDragNode(nodeId)
    const svg = svgRef.current
    if (!svg) return
    const pt = svg.getBoundingClientRect()
    setDragOffset({ x: e.clientX - pt.left - node.position_x, y: e.clientY - pt.top - node.position_y })
  }
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragNode) return
    const svg = svgRef.current
    if (!svg) return
    const pt = svg.getBoundingClientRect()
    onUpdateNode(dragNode, { position_x: Math.round(e.clientX - pt.left - dragOffset.x), position_y: Math.round(e.clientY - pt.top - dragOffset.y) })
  }, [dragNode, dragOffset, onUpdateNode])
  const handleMouseUp = useCallback(() => { setDragNode(null) }, [])

  useEffect(() => {
    if (!dragNode) return
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp) }
  }, [dragNode, handleMouseMove, handleMouseUp])

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

  /* ---- Link click ---- */
  const handleLinkClick = (linkId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedLinkId(linkId)
    setSelectedNodeId(null)
  }

  /* ---- Delete node (cascade links) ---- */
  const handleDeleteNode = async (nodeId: string) => {
    const orphanLinks = links.filter((l) => l.from_node_id === nodeId || l.to_node_id === nodeId)
    for (const l of orphanLinks) { await onDeleteLink(l.id) }
    await onDeleteNode(nodeId)
    setSelectedNodeId(null)
  }

  /* ---- Add node ---- */
  const handleAddNode = () => {
    const prefix = NODE_LABELS[addType]?.substring(0, 3).toUpperCase() ?? 'NOD'
    const count = nodes.filter((n) => n.node_type === addType).length + 1
    onAddNode({
      node_type: addType,
      label: `${prefix}-${count}`,
      position_x: 150 + Math.random() * 500,
      position_y: 80 + Math.random() * 350,
      layer: activeLayer ?? 'data_link',
      properties: {},
    })
  }

  /* ---- SVG click (deselect) ---- */
  const handleSvgClick = () => {
    if (!linkMode) {
      setSelectedNodeId(null)
      setSelectedLinkId(null)
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.bg, overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 6, padding: '8px 12px', borderBottom: `1px solid ${C.border}`, flexShrink: 0, alignItems: 'center' }}>
        {/* Layer filters */}
        <button onClick={() => setActiveLayer(null)} style={{ padding: '3px 8px', fontSize: 10, fontWeight: 600, borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit', background: !activeLayer ? C.accentSubtle : C.bgActive, color: !activeLayer ? C.accent : C.textDim, border: !activeLayer ? `1px solid ${C.accent}` : `1px solid ${C.border}` }}>All</button>
        {LAYERS.map((l) => (
          <button key={l} onClick={() => setActiveLayer(l)} style={{ padding: '3px 8px', fontSize: 10, fontWeight: 600, borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit', background: activeLayer === l ? C.accentSubtle : C.bgActive, color: activeLayer === l ? C.accent : C.textDim, border: activeLayer === l ? `1px solid ${C.accent}` : `1px solid ${C.border}` }}>{LAYER_LABELS[l]}</button>
        ))}
        <div style={{ width: 1, height: 16, background: C.border, margin: '0 4px' }} />
        {/* Link mode toggle */}
        <button onClick={() => { setLinkMode(!linkMode); setLinkSourceId(null) }}
          style={{ padding: '3px 8px', fontSize: 10, fontWeight: 600, borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
            background: linkMode ? 'rgba(34,197,94,0.15)' : C.bgActive, color: linkMode ? C.green : C.textDim,
            border: linkMode ? `1px solid ${C.green}` : `1px solid ${C.border}` }}>
          {linkMode ? (linkSourceId ? 'Click Target...' : 'Click Source...') : 'Link Mode'}
        </button>
        <div style={{ flex: 1 }} />
        {/* Add node */}
        <select value={addType} onChange={(e) => setAddType(e.target.value)}
          style={{ padding: '3px 6px', fontSize: 10, borderRadius: 4, background: C.bgActive, color: C.text, border: `1px solid ${C.border}`, outline: 'none', fontFamily: 'inherit' }}>
          {NODE_TYPES.map((t) => <option key={t} value={t}>{NODE_LABELS[t]}</option>)}
        </select>
        <button onClick={handleAddNode} style={{ padding: '3px 10px', fontSize: 10, fontWeight: 500, borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit', background: C.accent, color: '#fff', border: 'none' }}>+ Add Node</button>
        {/* Count */}
        <span style={{ fontSize: 10, color: C.textDim }}>{filteredNodes.length}N / {filteredLinks.length}L</span>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* SVG Canvas */}
        <div style={{ flex: 1, position: 'relative', overflow: 'auto' }}>
          <svg ref={svgRef} width="100%" height="100%" style={{ minWidth: 900, minHeight: 600, cursor: linkMode ? 'crosshair' : 'default' }} onClick={handleSvgClick}>
            {/* Grid dots */}
            <defs>
              <pattern id="topo-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <circle cx="20" cy="20" r="0.5" fill={C.borderSubtle} />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#topo-grid)" />

            {/* Links */}
            {filteredLinks.map((link) => {
              const src = nodes.find((n) => n.id === link.from_node_id)
              const tgt = nodes.find((n) => n.id === link.to_node_id)
              if (!src || !tgt) return null
              const midX = (src.position_x + tgt.position_x) / 2
              const midY = (src.position_y + tgt.position_y) / 2
              const isSel = link.id === selectedLinkId
              return (
                <g key={link.id} onClick={(e) => handleLinkClick(link.id, e)} style={{ cursor: 'pointer' }}>
                  {/* Hit area */}
                  <line x1={src.position_x} y1={src.position_y} x2={tgt.position_x} y2={tgt.position_y} stroke="transparent" strokeWidth={12} />
                  {/* Visible line */}
                  <line x1={src.position_x} y1={src.position_y} x2={tgt.position_x} y2={tgt.position_y}
                    stroke={isSel ? '#fff' : C.textDim} strokeWidth={isSel ? 2.5 : link.is_trunk ? 2 : 1.5}
                    strokeDasharray={link.is_trunk ? 'none' : '6 3'} />
                  {/* Speed label */}
                  {link.speed && (
                    <text x={midX} y={midY - 6} textAnchor="middle" fill={isSel ? '#fff' : C.textMuted} fontSize={9} fontFamily="'IBM Plex Mono', monospace">{link.speed}</text>
                  )}
                  {/* Cable type label */}
                  {link.cable_type && (
                    <text x={midX} y={midY + 10} textAnchor="middle" fill={C.textDim} fontSize={8} fontFamily="'IBM Plex Mono', monospace">{link.cable_type}</text>
                  )}
                </g>
              )
            })}

            {/* Link-in-progress line */}
            {linkMode && linkSourceId && (() => {
              const src = nodes.find((n) => n.id === linkSourceId)
              if (!src) return null
              return <circle cx={src.position_x} cy={src.position_y} r={28} fill="none" stroke={C.green} strokeWidth={2} strokeDasharray="4 3" />
            })()}

            {/* Nodes */}
            {filteredNodes.map((node) => {
              const color = NODE_COLORS[node.node_type ?? 'endpoint'] || C.textMuted
              const isSel = node.id === selectedNodeId
              const isLinkSrc = node.id === linkSourceId
              return (
                <g key={node.id}
                  transform={`translate(${node.position_x}, ${node.position_y})`}
                  onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(node.id, e) }}
                  onClick={(e) => { e.stopPropagation(); handleNodeClick(node.id) }}
                  style={{ cursor: linkMode ? 'crosshair' : dragNode === node.id ? 'grabbing' : 'grab' }}>
                  <NodeShape type={node.node_type} color={color} selected={isSel || isLinkSrc} />
                  <text x={0} y={3} textAnchor="middle" fill={C.text} fontSize={10} fontWeight={600} fontFamily="'IBM Plex Sans', sans-serif" pointerEvents="none">{node.label}</text>
                  <text x={0} y={NODE_H / 2 + 12} textAnchor="middle" fill={C.textDim} fontSize={8} fontFamily="'IBM Plex Mono', monospace" pointerEvents="none">{NODE_LABELS[node.node_type] ?? node.node_type}</text>
                </g>
              )
            })}
          </svg>
        </div>

        {/* Property Panel */}
        {(selectedNode || selectedLink) && (
          <div style={{ width: 240, borderLeft: `1px solid ${C.border}`, background: C.bgPanel, overflow: 'auto', flexShrink: 0 }}>
            {/* Node properties */}
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
                    <input type="number" defaultValue={selectedNode.position_x} style={{ ...inputStyle, fontFamily: "'IBM Plex Mono', monospace" }}
                      onBlur={(e) => onUpdateNode(selectedNode.id, { position_x: Number(e.target.value) })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={labelStyle}>Y</div>
                    <input type="number" defaultValue={selectedNode.position_y} style={{ ...inputStyle, fontFamily: "'IBM Plex Mono', monospace" }}
                      onBlur={(e) => onUpdateNode(selectedNode.id, { position_y: Number(e.target.value) })} />
                  </div>
                </div>
                {/* Connected links count */}
                <div style={{ fontSize: 10, color: C.textDim }}>
                  {links.filter((l) => l.from_node_id === selectedNode.id || l.to_node_id === selectedNode.id).length} connection(s)
                </div>
                <button onClick={() => handleDeleteNode(selectedNode.id)}
                  style={{ padding: '4px 0', fontSize: 10, color: C.red, background: 'transparent', border: `1px solid ${C.red}`, borderRadius: 4, cursor: 'pointer' }}>
                  Delete Node
                </button>
              </div>
            )}

            {/* Link properties */}
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
                  <input defaultValue={selectedLink.notes ?? ''} style={inputStyle}
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
