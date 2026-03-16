'use client'

import { useState, useEffect, useCallback } from 'react'
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
  onDeleteLink: (id: string) => Promise<unknown>
}

const NODE_COLORS: Record<string, string> = {
  switch: '#8b5cf6', router: '#3b82f6', firewall: '#ef4444', server: '#6366f1',
  nvr: '#14b8a6', wireless_ap: '#22c55e', camera: '#06b6d4', acs_controller: '#f97316', endpoint: '#64748b',
}
const LAYERS = ['physical', 'data_link', 'network']
const LAYER_LABELS: Record<string, string> = { physical: 'L1 Physical', data_link: 'L2 Data Link', network: 'L3 Network' }

export function TopologyView({ designId, nodes, links, onAddNode, onUpdateNode, onDeleteNode, onAddLink, onDeleteLink }: TopologyViewProps) {
  const [activeLayer, setActiveLayer] = useState<string | null>(null)
  const [dragNode, setDragNode] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  const filteredNodes = activeLayer ? nodes.filter((n) => n.layer === activeLayer) : nodes
  const filteredLinks = links.filter((l) => {
    const src = nodes.find((n) => n.id === l.from_node_id)
    const tgt = nodes.find((n) => n.id === l.to_node_id)
    if (!src || !tgt) return false
    if (!activeLayer) return true
    return src.layer === activeLayer || tgt.layer === activeLayer
  })

  const handleMouseDown = (nodeId: string, e: React.MouseEvent) => {
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return
    setDragNode(nodeId)
    setDragOffset({ x: e.clientX - node.position_x, y: e.clientY - node.position_y })
  }
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragNode) return
    onUpdateNode(dragNode, { position_x: Math.round(e.clientX - dragOffset.x), position_y: Math.round(e.clientY - dragOffset.y) })
  }, [dragNode, dragOffset, onUpdateNode])
  const handleMouseUp = useCallback(() => { setDragNode(null) }, [])

  useEffect(() => {
    if (!dragNode) return
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp) }
  }, [dragNode, handleMouseMove, handleMouseUp])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.bg, overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 6, padding: '8px 12px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <button onClick={() => setActiveLayer(null)} style={{ padding: '3px 8px', fontSize: 10, fontWeight: 600, borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit', background: !activeLayer ? C.accentSubtle : C.bgActive, color: !activeLayer ? C.accent : C.textDim, border: !activeLayer ? `1px solid ${C.accent}` : `1px solid ${C.border}` }}>All Layers</button>
        {LAYERS.map((l) => (
          <button key={l} onClick={() => setActiveLayer(l)} style={{ padding: '3px 8px', fontSize: 10, fontWeight: 600, borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit', background: activeLayer === l ? C.accentSubtle : C.bgActive, color: activeLayer === l ? C.accent : C.textDim, border: activeLayer === l ? `1px solid ${C.accent}` : `1px solid ${C.border}` }}>{LAYER_LABELS[l] || l}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={() => onAddNode({ node_type: 'switch', label: `SW-${nodes.length + 1}`, position_x: 200 + Math.random() * 400, position_y: 100 + Math.random() * 300, layer: activeLayer ?? 'data_link', properties: {} })} style={{ padding: '3px 8px', fontSize: 10, fontWeight: 500, borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit', background: C.accent, color: '#fff', border: 'none' }}>Add Node</button>
      </div>
      <div style={{ flex: 1, position: 'relative', overflow: 'auto' }}>
        <svg width="100%" height="100%" style={{ minWidth: 800, minHeight: 600 }}>
          {filteredLinks.map((link) => {
            const src = nodes.find((n) => n.id === link.from_node_id)
            const tgt = nodes.find((n) => n.id === link.to_node_id)
            if (!src || !tgt) return null
            const midX = (src.position_x + tgt.position_x) / 2
            const midY = (src.position_y + tgt.position_y) / 2
            return (
              <g key={link.id}>
                <line x1={src.position_x} y1={src.position_y} x2={tgt.position_x} y2={tgt.position_y} stroke={C.textDim} strokeWidth={2} strokeDasharray={link.is_trunk ? 'none' : '4 2'} />
                {link.speed && <text x={midX} y={midY - 6} textAnchor="middle" fill={C.textMuted} fontSize={9} fontFamily="IBM Plex Mono">{link.speed}</text>}
              </g>
            )
          })}
          {filteredNodes.map((node) => {
            const color = NODE_COLORS[node.node_type ?? 'endpoint'] || C.textMuted
            return (
              <g key={node.id} onMouseDown={(e) => handleMouseDown(node.id, e)} style={{ cursor: 'grab' }}>
                <rect x={node.position_x - 30} y={node.position_y - 20} width={60} height={40} rx={6} fill={C.bgPanel} stroke={color} strokeWidth={2} />
                <text x={node.position_x} y={node.position_y + 4} textAnchor="middle" fill={C.text} fontSize={10} fontWeight={600} fontFamily="IBM Plex Sans">{node.label}</text>
                <text x={node.position_x} y={node.position_y + 30} textAnchor="middle" fill={C.textDim} fontSize={8} fontFamily="IBM Plex Mono">{node.node_type}</text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
