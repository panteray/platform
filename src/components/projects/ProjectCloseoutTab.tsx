'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { CheckCircle2, XCircle, FileSignature, AlertTriangle, Shield, Loader2 } from 'lucide-react'

interface Props { projectId: string }

interface GateStatus {
  install_complete: boolean
  all_co_closed: boolean
  qc_passed: boolean
  install_count: number
  installed_count: number
  open_co_count: number
  qc_count: number
  qc_approved_count: number
}

interface SosData {
  id: string
  status: string
  customer_name: string | null
  customer_signed_at: string | null
  sub_signed_at: string | null
  pm_signed_at: string | null
}

export function ProjectCloseoutTab({ projectId }: Props) {
  const [gates, setGates] = useState<GateStatus | null>(null)
  const [sos, setSos] = useState<SosData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSosForm, setShowSosForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // SOS form
  const [customerName, setCustomerName] = useState('')
  const [customerTitle, setCustomerTitle] = useState('')
  const [scopeSummary, setScopeSummary] = useState('')
  const [hasSigned, setHasSigned] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/org/projects/${projectId}/closeout`)
    if (res.ok) {
      const data = await res.json()
      setGates(data.gates)
      setSos(data.sos)
    }
    setLoading(false)
  }, [projectId])

  useEffect(() => { load() }, [load])

  // Signature canvas
  const getCtx = () => canvasRef.current?.getContext('2d')

  const startDraw = useCallback((x: number, y: number) => {
    const ctx = getCtx()
    if (!ctx) return
    setIsDrawing(true)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }, [])

  const draw = useCallback((x: number, y: number) => {
    if (!isDrawing) return
    const ctx = getCtx()
    if (!ctx) return
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineTo(x, y)
    ctx.stroke()
    setHasSigned(true)
  }, [isDrawing])

  const stopDraw = useCallback(() => setIsDrawing(false), [])

  const clearSig = () => {
    const ctx = getCtx()
    const canvas = canvasRef.current
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      setHasSigned(false)
    }
  }

  const handleSubmitSos = async () => {
    if (!hasSigned || !customerName.trim()) return
    setSubmitting(true)

    const sigData = canvasRef.current?.toDataURL('image/png') ?? null

    const res = await fetch(`/api/org/projects/${projectId}/closeout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: customerName.trim(),
        customer_title: customerTitle.trim() || null,
        customer_sig_data: sigData,
        customer_signed_at: new Date().toISOString(),
        scope_summary: scopeSummary.trim() || null,
        status: 'pending_sub',
      }),
    })

    if (res.ok) {
      await load()
      setShowSosForm(false)
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const allGatesPassed = gates?.install_complete && gates?.all_co_closed && gates?.qc_passed

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Closeout & Sign-Off</h3>
        <p className="text-xs text-muted-foreground">Execution gates and customer acceptance</p>
      </div>

      {/* Gate Status */}
      <div className="grid grid-cols-3 gap-3">
        {/* Install Gate */}
        <div className={`rounded-lg border p-3 ${gates?.install_complete ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
          <div className="flex items-center gap-2 mb-1">
            {gates?.install_complete
              ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              : <XCircle className="h-4 w-4 text-red-600" />}
            <span className="text-xs font-bold text-foreground">Install Gate</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {gates?.installed_count ?? 0}/{gates?.install_count ?? 0} items verified
          </p>
        </div>

        {/* CO Gate */}
        <div className={`rounded-lg border p-3 ${gates?.all_co_closed ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          <div className="flex items-center gap-2 mb-1">
            {gates?.all_co_closed
              ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              : <AlertTriangle className="h-4 w-4 text-amber-600" />}
            <span className="text-xs font-bold text-foreground">CO Gate</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {gates?.open_co_count === 0 ? 'All COs closed' : `${gates?.open_co_count} open COs`}
          </p>
        </div>

        {/* QC Gate */}
        <div className={`rounded-lg border p-3 ${gates?.qc_passed ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          <div className="flex items-center gap-2 mb-1">
            {gates?.qc_passed
              ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              : <AlertTriangle className="h-4 w-4 text-amber-600" />}
            <span className="text-xs font-bold text-foreground">QC Gate</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {gates?.qc_approved_count ?? 0}/{gates?.qc_count ?? 0} areas approved
          </p>
        </div>
      </div>

      {/* SOS Status */}
      {sos ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-600" />
            <h4 className="text-sm font-bold text-emerald-800">Sign-Off Sheet</h4>
            <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-[9px] font-bold text-emerald-800">
              {sos.status.replace(/_/g, ' ').toUpperCase()}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-[10px]">
            <div>
              <p className="font-semibold text-muted-foreground">Customer</p>
              <p className="text-foreground">{sos.customer_name ?? '—'}</p>
              {sos.customer_signed_at && (
                <p className="text-emerald-600">{new Date(sos.customer_signed_at).toLocaleDateString()}</p>
              )}
            </div>
            <div>
              <p className="font-semibold text-muted-foreground">Subcontractor</p>
              <p className="text-foreground">{sos.sub_signed_at ? 'Signed' : 'Pending'}</p>
            </div>
            <div>
              <p className="font-semibold text-muted-foreground">PM</p>
              <p className="text-foreground">{sos.pm_signed_at ? 'Signed' : 'Pending'}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {!showSosForm ? (
            <div className="flex flex-col items-center py-8">
              <FileSignature className="mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No Sign-Off Sheet yet</p>
              {!allGatesPassed && (
                <p className="text-[10px] text-amber-600 mt-1">All gates must pass before SOS can be submitted</p>
              )}
              <button
                onClick={() => setShowSosForm(true)}
                disabled={!allGatesPassed}
                className="mt-3 inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <FileSignature className="h-3.5 w-3.5" /> Create Sign-Off Sheet
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
              <h4 className="text-sm font-semibold">Customer Sign-Off Sheet</h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Customer Name *</label>
                  <input
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="Full name"
                    className="w-full rounded border border-border bg-background px-2.5 py-2 text-xs outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Title</label>
                  <input
                    value={customerTitle}
                    onChange={e => setCustomerTitle(e.target.value)}
                    placeholder="e.g. Facilities Manager"
                    className="w-full rounded border border-border bg-background px-2.5 py-2 text-xs outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Scope Summary</label>
                <textarea
                  value={scopeSummary}
                  onChange={e => setScopeSummary(e.target.value)}
                  placeholder="Brief summary of completed work..."
                  rows={3}
                  className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary resize-none"
                />
              </div>

              {/* Signature Pad */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-semibold text-muted-foreground">Signature *</label>
                  {hasSigned && (
                    <button onClick={clearSig} className="text-[10px] text-muted-foreground hover:text-foreground">
                      Clear
                    </button>
                  )}
                </div>
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={120}
                  className="w-full rounded-lg border-2 border-dashed border-border bg-white cursor-crosshair touch-none"
                  onMouseDown={e => {
                    const rect = canvasRef.current!.getBoundingClientRect()
                    startDraw(e.clientX - rect.left, e.clientY - rect.top)
                  }}
                  onMouseMove={e => {
                    const rect = canvasRef.current!.getBoundingClientRect()
                    draw(e.clientX - rect.left, e.clientY - rect.top)
                  }}
                  onMouseUp={stopDraw}
                  onMouseLeave={stopDraw}
                  onTouchStart={e => {
                    const rect = canvasRef.current!.getBoundingClientRect()
                    const touch = e.touches[0]
                    startDraw(touch.clientX - rect.left, touch.clientY - rect.top)
                  }}
                  onTouchMove={e => {
                    const rect = canvasRef.current!.getBoundingClientRect()
                    const touch = e.touches[0]
                    draw(touch.clientX - rect.left, touch.clientY - rect.top)
                  }}
                  onTouchEnd={stopDraw}
                />
                {!hasSigned && (
                  <p className="text-center text-[10px] text-muted-foreground mt-1">Sign above</p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSubmitSos}
                  disabled={!hasSigned || !customerName.trim() || submitting}
                  className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSignature className="h-3.5 w-3.5" />}
                  {submitting ? 'Submitting...' : 'Submit SOS'}
                </button>
                <button onClick={() => setShowSosForm(false)} className="text-xs text-muted-foreground hover:text-foreground">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
