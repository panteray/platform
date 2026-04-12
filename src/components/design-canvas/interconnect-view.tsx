'use client'

import { useState } from 'react'
import { Plus, Trash2, Link2, Server, Wifi, Monitor, Zap } from 'lucide-react'
import { C } from './constants'
import type { InterconnectNode, InterconnectLink } from '@/types/database'

const NODE_TYPES = [
  { id: 'rack', label: 'Rack/MDF', icon: Server, color: '#6b7280' },
  { id: 'idf', label: 'IDF', icon: Server, color: '#3b82f6' },
  { id: 'switch', label: 'Switch', icon: Wifi, color: '#22c55e' },
  { id: 'controller', label: 'Controller', icon: Zap, color: '#f97316' },
  { id: 'device', label: 'Device', icon: Monitor, color: '#8b5cf6' },
  { id: 'patch_panel', label: 'Patch Panel', icon: Link2, color: '#64748b' },
]

const LINK_TYPES = ['ethernet', 'fiber', 'power', 'io']

interface Props {
  designId: string
  nodes: InterconnectNode[]
  links: InterconnectLink[]
  onAddNode: (data: Record<string, unknown>) => Promise<InterconnectNode | null>
  onUpdateNode: (id: string, data: Record<string, unknown>) => Promise<unknown>
  onDeleteNode: (id: string) => Promise<boolean>
  onAddLink: (data: Record<string, unknown>) => Promise<InterconnectLink | null>
  onUpdateLink: (id: string, data: Record<string, unknown>) => Promise<unknown>
  onDeleteLink: (id: string) => Promise<boolean>
}

export function InterconnectView({
  designId, nodes, links,
  onAddNode, onDeleteNode,
  onAddLink, onDeleteLink,
}: Props) {
  const [newNodeType, setNewNodeType] = useState('switch')
  const [newNodeLabel, setNewNodeLabel] = useState('')
  const [linkFrom, setLinkFrom] = useState('')
  const [linkTo, setLinkTo] = useState('')
  const [linkType, setLinkType] = useState('ethernet')

  const handleAddNode = async () => {
    if (!newNodeLabel.trim()) return
    await onAddNode({ design_id: designId, node_type: newNodeType, label: newNodeLabel.trim(), properties: {} })
    setNewNodeLabel('')
  }

  const handleAddLink = async () => {
    if (!linkFrom || !linkTo || linkFrom === linkTo) return
    await onAddLink({ design_id: designId, from_node_id: linkFrom, to_node_id: linkTo, link_type: linkType, properties: {} })
    setLinkFrom('')
    setLinkTo('')
  }

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 16 }}>Interconnect Wiring</div>
      <div style={{ fontSize: 11, color: C.textDim, marginBottom: 20 }}>
        Simplified wiring reference for field technicians — physical connections between infrastructure components.
      </div>

      {/* Add Node */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <select value={newNodeType} onChange={e => setNewNodeType(e.target.value)}
          style={{ padding: '6px 10px', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 11, fontFamily: 'inherit', outline: 'none' }}>
          {NODE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <input value={newNodeLabel} onChange={e => setNewNodeLabel(e.target.value)} placeholder="Node label..."
          onKeyDown={e => e.key === 'Enter' && handleAddNode()}
          style={{ flex: 1, padding: '6px 10px', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 11, outline: 'none' }} />
        <button onClick={handleAddNode} style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: C.accent, color: '#fff',
          border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer',
        }}><Plus size={12} /> Add Node</button>
      </div>

      {/* Nodes list */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {nodes.map(n => {
          const typeDef = NODE_TYPES.find(t => t.id === n.node_type) || NODE_TYPES[0]
          const Icon = typeDef.icon
          return (
            <div key={n.id} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
              background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 6,
            }}>
              <Icon size={14} style={{ color: typeDef.color }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>{n.label}</span>
              <span style={{ fontSize: 8, color: C.textDim, textTransform: 'uppercase' }}>{n.node_type}</span>
              <button onClick={() => onDeleteNode(n.id)} style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', padding: 2, opacity: 0.4 }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '1')} onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}>
                <Trash2 size={10} />
              </button>
            </div>
          )
        })}
        {nodes.length === 0 && <div style={{ fontSize: 11, color: C.textDim, fontStyle: 'italic' }}>No nodes yet. Add infrastructure components above.</div>}
      </div>

      {/* Add Link */}
      {nodes.length >= 2 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
          <select value={linkFrom} onChange={e => setLinkFrom(e.target.value)}
            style={{ flex: 1, padding: '6px 10px', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 11, fontFamily: 'inherit', outline: 'none' }}>
            <option value="">From...</option>
            {nodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
          </select>
          <span style={{ fontSize: 11, color: C.textDim }}>→</span>
          <select value={linkTo} onChange={e => setLinkTo(e.target.value)}
            style={{ flex: 1, padding: '6px 10px', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 11, fontFamily: 'inherit', outline: 'none' }}>
            <option value="">To...</option>
            {nodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
          </select>
          <select value={linkType} onChange={e => setLinkType(e.target.value)}
            style={{ padding: '6px 10px', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 11, fontFamily: 'inherit', outline: 'none' }}>
            {LINK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button onClick={handleAddLink} style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: '#22c55e', color: '#fff',
            border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}><Link2 size={12} /> Connect</button>
        </div>
      )}

      {/* Links table */}
      {links.length > 0 && (
        <div style={{ borderRadius: 6, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: C.bgSurface, borderBottom: `1px solid ${C.border}` }}>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: C.textDim, fontSize: 9, textTransform: 'uppercase' }}>From</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: C.textDim, fontSize: 9, textTransform: 'uppercase' }}>To</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: C.textDim, fontSize: 9, textTransform: 'uppercase' }}>Type</th>
                <th style={{ padding: '6px 10px', width: 30 }}></th>
              </tr>
            </thead>
            <tbody>
              {links.map(l => {
                const fromNode = nodes.find(n => n.id === l.from_node_id)
                const toNode = nodes.find(n => n.id === l.to_node_id)
                const typeColor = l.link_type === 'fiber' ? '#3b82f6' : l.link_type === 'power' ? '#ef4444' : l.link_type === 'io' ? '#f97316' : '#22c55e'
                return (
                  <tr key={l.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '6px 10px', color: C.text }}>{fromNode?.label || '?'}</td>
                    <td style={{ padding: '6px 10px', color: C.text }}>{toNode?.label || '?'}</td>
                    <td style={{ padding: '6px 10px' }}>
                      <span style={{ padding: '1px 6px', borderRadius: 3, fontSize: 9, fontWeight: 600, background: `${typeColor}15`, color: typeColor, border: `1px solid ${typeColor}30` }}>
                        {l.link_type}
                      </span>
                    </td>
                    <td style={{ padding: '6px 10px' }}>
                      <button onClick={() => onDeleteLink(l.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 2, opacity: 0.4 }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '1')} onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}>
                        <Trash2 size={10} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
