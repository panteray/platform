'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import {
  FileText, CheckCircle2, AlertCircle, Clock, Shield,
  ChevronDown, ChevronUp, Pen,
} from 'lucide-react'

interface PortalData {
  customer: { name: string; contact_name: string | null; contact_email: string | null }
  opportunity: { opp_number: string; project_name: string | null; quote_amount: number | null; order_amount: number | null }
  permissions: string[]
  accepted: boolean
  accepted_at: string | null
  sow?: { scope_text: string; exclusions: string; terms: string } | null
  hardware_schedule?: Array<Record<string, unknown>> | null
  quote?: { quote_amount: number | null; order_amount: number | null } | null
}

export default function CustomerPortalPage() {
  const params = useParams<{ token: string }>()
  const [data, setData] = useState<PortalData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSow, setShowSow] = useState(true)
  const [showHw, setShowHw] = useState(false)
  const [acceptName, setAcceptName] = useState('')
  const [acceptEmail, setAcceptEmail] = useState('')
  const [signing, setSigning] = useState(false)
  const [signatureData, setSignatureData] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)

  useEffect(() => {
    if (!params?.token) return
    fetch(`/api/portal/${params.token}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json()
          setError(err.error || 'Failed to load')
          setLoading(false)
          return
        }
        setData(await res.json())
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to connect')
        setLoading(false)
      })
  }, [params?.token])

  // Signature canvas
  const initCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
  }

  useEffect(() => {
    if (signing) setTimeout(initCanvas, 100)
  }, [signing])

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDrawing.current = true
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.beginPath()
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
  }

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
    ctx.stroke()
  }

  const handleCanvasMouseUp = () => {
    isDrawing.current = false
    const canvas = canvasRef.current
    if (canvas) setSignatureData(canvas.toDataURL('image/png'))
  }

  const handleAccept = async () => {
    if (!acceptName || !acceptEmail) {
      alert('Please enter your name and email')
      return
    }
    if (!confirm('By accepting, you acknowledge and agree to the terms presented. Continue?')) return

    const res = await fetch(`/api/portal/${params?.token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: acceptName,
        email: acceptEmail,
        signature: signatureData || null,
      }),
    })

    if (res.ok) {
      setData(prev => prev ? { ...prev, accepted: true, accepted_at: new Date().toISOString() } : prev)
    } else {
      const err = await res.json()
      alert(err.error || 'Failed to accept')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="max-w-sm text-center">
          <AlertCircle className="mx-auto mb-3 h-12 w-12 text-red-500" />
          <h1 className="text-lg font-bold text-neutral-900">{error}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            This link may have expired or been deactivated. Contact the sender for a new link.
          </p>
        </div>
      </div>
    )
  }

  if (!data) return null

  const { customer, opportunity, permissions } = data
  const amount = data.quote?.order_amount || data.quote?.quote_amount

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="border-b border-neutral-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-3xl flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-neutral-900">Document Portal</h1>
            <p className="text-sm text-neutral-500">
              {customer?.name} — {opportunity?.opp_number}
              {opportunity?.project_name && ` — ${opportunity.project_name}`}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-neutral-500">
            <Shield className="h-4 w-4" />
            Secure Link
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-6 space-y-4">
        {/* Accepted Banner */}
        {data.accepted && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">Accepted</p>
              <p className="text-xs text-emerald-600">
                Accepted on {data.accepted_at ? new Date(data.accepted_at).toLocaleString() : ''}
              </p>
            </div>
          </div>
        )}

        {/* Quote Summary */}
        {permissions.includes('view_quote') && amount != null && (
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-neutral-900 mb-2">Quote Summary</h2>
            <div className="text-2xl font-bold text-neutral-900">${amount.toLocaleString()}</div>
          </div>
        )}

        {/* SOW */}
        {permissions.includes('view_sow') && (
          <div className="rounded-lg border border-neutral-200 bg-white">
            <button
              onClick={() => setShowSow(!showSow)}
              className="flex w-full items-center justify-between px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-neutral-500" />
                <span className="text-sm font-semibold text-neutral-900">Scope of Work</span>
              </div>
              {showSow ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showSow && data.sow && (
              <div className="border-t border-neutral-200 px-4 py-4 space-y-3">
                {data.sow.scope_text && (
                  <div>
                    <h3 className="text-xs font-semibold text-neutral-500 uppercase mb-1">Scope</h3>
                    <p className="text-sm text-neutral-700 whitespace-pre-wrap">{data.sow.scope_text}</p>
                  </div>
                )}
                {data.sow.exclusions && (
                  <div>
                    <h3 className="text-xs font-semibold text-neutral-500 uppercase mb-1">Exclusions</h3>
                    <p className="text-sm text-neutral-700 whitespace-pre-wrap">{data.sow.exclusions}</p>
                  </div>
                )}
                {data.sow.terms && (
                  <div>
                    <h3 className="text-xs font-semibold text-neutral-500 uppercase mb-1">Terms & Conditions</h3>
                    <p className="text-sm text-neutral-700 whitespace-pre-wrap">{data.sow.terms}</p>
                  </div>
                )}
                {!data.sow.scope_text && !data.sow.exclusions && (
                  <p className="text-sm text-neutral-400 italic">No SOW content available yet</p>
                )}
              </div>
            )}
            {showSow && !data.sow && (
              <div className="border-t border-neutral-200 px-4 py-4">
                <p className="text-sm text-neutral-400 italic">SOW not yet published</p>
              </div>
            )}
          </div>
        )}

        {/* Hardware Schedule */}
        {permissions.includes('view_hardware_schedule') && (
          <div className="rounded-lg border border-neutral-200 bg-white">
            <button
              onClick={() => setShowHw(!showHw)}
              className="flex w-full items-center justify-between px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-neutral-500" />
                <span className="text-sm font-semibold text-neutral-900">
                  Hardware Schedule
                  {data.hardware_schedule && ` (${data.hardware_schedule.length} items)`}
                </span>
              </div>
              {showHw ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showHw && data.hardware_schedule && data.hardware_schedule.length > 0 && (
              <div className="border-t border-neutral-200 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50">
                      <th className="px-3 py-2 text-left font-semibold">#</th>
                      <th className="px-3 py-2 text-left font-semibold">Description</th>
                      <th className="px-3 py-2 text-left font-semibold">Vendor</th>
                      <th className="px-3 py-2 text-left font-semibold">Model</th>
                      <th className="px-3 py-2 text-right font-semibold">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.hardware_schedule.map((item, i) => (
                      <tr key={i} className="border-b border-neutral-100">
                        <td className="px-3 py-2 text-neutral-500">{(item.line_number as string) || i + 1}</td>
                        <td className="px-3 py-2 text-neutral-900">{(item.description as string) || '—'}</td>
                        <td className="px-3 py-2 text-neutral-500">{(item.vendor as string) || '—'}</td>
                        <td className="px-3 py-2 text-neutral-500">{(item.model as string) || '—'}</td>
                        <td className="px-3 py-2 text-right text-neutral-900">{(item.quantity as number) || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {showHw && (!data.hardware_schedule || data.hardware_schedule.length === 0) && (
              <div className="border-t border-neutral-200 px-4 py-4">
                <p className="text-sm text-neutral-400 italic">No hardware schedule items</p>
              </div>
            )}
          </div>
        )}

        {/* Acceptance Section */}
        {!data.accepted && (
          <div className="rounded-lg border-2 border-neutral-300 bg-white p-6 space-y-4">
            <h2 className="text-sm font-bold text-neutral-900">Accept & Authorize</h2>
            <p className="text-xs text-neutral-500">
              By signing below, you authorize the work described in the documents above.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-0.5">Full Name *</label>
                <input
                  value={acceptName}
                  onChange={(e) => setAcceptName(e.target.value)}
                  className="w-full rounded border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-0.5">Email *</label>
                <input
                  type="email"
                  value={acceptEmail}
                  onChange={(e) => setAcceptEmail(e.target.value)}
                  className="w-full rounded border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
                  placeholder="john@company.com"
                />
              </div>
            </div>

            {/* Signature Pad */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-neutral-600">Signature (optional)</label>
                {!signing && (
                  <button
                    onClick={() => setSigning(true)}
                    className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900"
                  >
                    <Pen className="h-3 w-3" /> Add Signature
                  </button>
                )}
                {signing && (
                  <button
                    onClick={() => { setSigning(false); setSignatureData('') }}
                    className="text-xs text-neutral-500 hover:text-neutral-900"
                  >
                    Clear
                  </button>
                )}
              </div>
              {signing && (
                <canvas
                  ref={canvasRef}
                  width={500}
                  height={120}
                  className="w-full rounded border border-neutral-300 cursor-crosshair"
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                />
              )}
            </div>

            <button
              onClick={handleAccept}
              disabled={!acceptName || !acceptEmail}
              className="w-full rounded-lg bg-neutral-900 py-3 text-sm font-bold text-white hover:bg-neutral-800 disabled:opacity-40 transition-colors"
            >
              Accept & Authorize
            </button>

            <p className="text-[10px] text-neutral-400 text-center">
              Your IP address and timestamp will be recorded for verification purposes.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
