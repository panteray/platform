'use client'

import { useState } from 'react'
import { Route, Play } from 'lucide-react'
import { C } from './constants'
import { tracePathBFS, type PathTraceResult } from '@/lib/calculators/path-trace'
import type { DesignTopologyNode, DesignTopologyLink } from '@/types/database'

interface Props {
  nodes: DesignTopologyNode[]
  links: DesignTopologyLink[]
}

export function PathTracePanel({ nodes, links }: Props) {
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [result, setResult] = useState<PathTraceResult | null>(null)

  const runTrace = () => {
    if (!fromId || !toId) return
    const r = tracePathBFS(fromId, toId, links)
    setResult(r)
  }

  return (
    <div style={{ padding: 16, maxWidth: 500, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Route size={16} style={{ color: C.accent }} />
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Path Trace</div>
      </div>
      <div style={{ fontSize: 11, color: C.textDim, marginBottom: 12 }}>
        Select source and destination to trace the hop-by-hop route through the network topology.
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <select value={fromId} onChange={e => { setFromId(e.target.value); setResult(null) }}
          style={{ flex: 1, padding: '6px 10px', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 11, fontFamily: 'inherit', outline: 'none' }}>
          <option value="">Source...</option>
          {nodes.map(n => <option key={n.id} value={n.id}>{n.label} ({n.node_type})</option>)}
        </select>
        <span style={{ fontSize: 11, color: C.textDim }}>→</span>
        <select value={toId} onChange={e => { setToId(e.target.value); setResult(null) }}
          style={{ flex: 1, padding: '6px 10px', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 11, fontFamily: 'inherit', outline: 'none' }}>
          <option value="">Destination...</option>
          {nodes.map(n => <option key={n.id} value={n.id}>{n.label} ({n.node_type})</option>)}
        </select>
        <button onClick={runTrace} disabled={!fromId || !toId}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: fromId && toId ? C.accent : C.bgActive, color: fromId && toId ? '#fff' : C.textDim, border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: fromId && toId ? 'pointer' : 'default', fontFamily: 'inherit' }}>
          <Play size={12} /> Trace
        </button>
      </div>

      {result && (
        <div style={{ padding: 12, borderRadius: 6, border: `1px solid ${result.found ? '#22c55e40' : '#ef444440'}`, background: result.found ? 'rgba(34,197,94,0.04)' : 'rgba(239,68,68,0.04)' }}>
          {result.found ? (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#22c55e', marginBottom: 8 }}>
                Route found — {result.hops} hop{result.hops !== 1 ? 's' : ''}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {result.path.map((nodeId, i) => {
                  const node = nodes.find(n => n.id === nodeId)
                  const isFirst = i === 0
                  const isLast = i === result.path.length - 1
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {i > 0 && <div style={{ width: 1, height: 12, background: C.accent, marginLeft: 7 }} />}
                      <div style={{
                        width: 16, height: 16, borderRadius: '50%',
                        background: isFirst ? '#22c55e' : isLast ? '#ef4444' : C.accent,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 8, fontWeight: 700, color: '#fff',
                      }}>
                        {i + 1}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: isFirst || isLast ? 700 : 500, color: C.text }}>
                        {node?.label || nodeId}
                      </span>
                      <span style={{ fontSize: 8, color: C.textDim, textTransform: 'uppercase' }}>{node?.node_type}</span>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>
              No route found between these nodes
            </div>
          )}
        </div>
      )}

      {!result && nodes.length < 2 && (
        <div style={{ padding: 16, textAlign: 'center', fontSize: 11, color: C.textDim, border: `1px dashed ${C.border}`, borderRadius: 6 }}>
          Add at least 2 topology nodes and connect them with links to use path trace.
        </div>
      )}
    </div>
  )
}
