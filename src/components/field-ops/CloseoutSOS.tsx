'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { FileSignature, CheckCircle2, AlertTriangle, XCircle, Trash2, Loader2, Shield } from 'lucide-react'

interface Props {
  projectId: string
  projectName: string
}

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

export function CloseoutSOS({ projectId, projectName }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSigned, setHasSigned] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerTitle, setCustomerTitle] = useState('')
  const [gates, setGates] = useState<GateStatus | null>(null)
  const [sos, setSos] = useState<SosData | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/org/projects/${projectId}/closeout`)
      if (res.ok) {
        const data = await res.json()
        setGates(data.gates)
        setSos(data.sos)
      }
      setLoading(false)
    })()
  }, [projectId])

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

  const handleSubmit = async () => {
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
        status: 'pending_sub',
      }),
    })

    if (res.ok) {
      const data = await res.json()
      setSos({ id: data.id, status: data.status, customer_name: data.customer_name, customer_signed_at: data.customer_signed_at, sub_signed_at: null, pm_signed_at: null })
    }
    setSubmitting(false)
  }

  const allGatesPassed = gates?.install_complete && gates?.all_co_closed && gates?.qc_passed
  const canSubmit = hasSigned && customerName.trim() && allGatesPassed

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  // Already submitted
  if (sos) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Shield className="h-12 w-12 text-emerald-500 mb-3" />
        <h2 className="text-base font-bold text-foreground">Sign-Off Sheet Submitted</h2>
        <p className="text-xs text-muted-foreground mt-1">{projectName}</p>
        <p className="text-xs text-muted-foreground">Signed by: {sos.customer_name}</p>
        <span className="mt-2 rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-bold text-emerald-700">
          {sos.status.replace(/_/g, ' ').toUpperCase()}
        </span>
        {sos.customer_signed_at && (
          <p className="text-[10px] text-muted-foreground mt-2">
            {new Date(sos.customer_signed_at).toLocaleString()}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3 max-w-lg mx-auto">
      <div>
        <h2 className="text-sm font-bold text-foreground">Closeout — Sign-Off Sheet</h2>
        <p className="text-[10px] text-muted-foreground">Customer acceptance signature for {projectName}</p>
      </div>

      {/* Gate Checks */}
      <div className="space-y-1.5">
        <div className={`flex items-center gap-2 rounded-lg border p-2.5 ${gates?.install_complete ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
          {gates?.install_complete ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
          <div>
            <p className="text-[10px] font-bold text-foreground">Install Complete</p>
            <p className="text-[9px] text-muted-foreground">{gates?.installed_count ?? 0}/{gates?.install_count ?? 0} items verified</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 rounded-lg border p-2.5 ${gates?.all_co_closed ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          {gates?.all_co_closed ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
          <div>
            <p className="text-[10px] font-bold text-foreground">All COs Closed</p>
            <p className="text-[9px] text-muted-foreground">{gates?.open_co_count === 0 ? 'No open COs' : `${gates?.open_co_count} open`}</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 rounded-lg border p-2.5 ${gates?.qc_passed ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          {gates?.qc_passed ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
          <div>
            <p className="text-[10px] font-bold text-foreground">QC Passed</p>
            <p className="text-[9px] text-muted-foreground">{gates?.qc_approved_count ?? 0}/{gates?.qc_count ?? 0} areas approved</p>
          </div>
        </div>
      </div>

      {/* Customer Info */}
      <div className="space-y-2">
        <div>
          <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Customer Name *</label>
          <input
            value={customerName}
            onChange={e => setCustomerName(e.target.value)}
            placeholder="Full name of signee"
            className="w-full rounded border border-border bg-background px-2.5 py-2 text-xs outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Title</label>
          <input
            value={customerTitle}
            onChange={e => setCustomerTitle(e.target.value)}
            placeholder="e.g. Facilities Manager"
            className="w-full rounded border border-border bg-background px-2.5 py-2 text-xs outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Signature Pad */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] font-medium text-muted-foreground">Signature *</label>
          {hasSigned && (
            <button onClick={clearSig} className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground">
              <Trash2 className="h-2.5 w-2.5" /> Clear
            </button>
          )}
        </div>
        <canvas
          ref={canvasRef}
          width={400}
          height={150}
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
          <p className="text-center text-[10px] text-muted-foreground mt-1">
            Sign above with finger or mouse
          </p>
        )}
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit || submitting}
        className="w-full rounded-lg bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {submitting ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>
        ) : (
          <><FileSignature className="h-4 w-4" /> Submit Sign-Off Sheet</>
        )}
      </button>
      {!allGatesPassed && (
        <p className="text-center text-[10px] text-amber-600">All gates must pass before SOS can be submitted</p>
      )}
    </div>
  )
}
