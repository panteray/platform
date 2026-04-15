'use client'

// CompletionModal — customer signature canvas + geolocation capture.
// Opens when a tech attempts COMPLETED → RESOLVED transition.
// Submits signature (base64 PNG) + lat/lng + resolution notes, then PATCHes the ticket
// and fires the transition. Parent handles reload.

import { useRef, useState, useEffect } from 'react'
import { X, MapPin, Loader2, AlertCircle, CheckCircle2, Eraser } from 'lucide-react'

type Props = {
  open: boolean
  ticketId: string
  onClose: () => void
  onComplete: () => void
  existingResolutionNotes?: string | null
}

export function CompletionModal({ open, ticketId, onClose, onComplete, existingResolutionNotes }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawing, setDrawing] = useState(false)
  const [hasInk, setHasInk] = useState(false)
  const [resolutionNotes, setResolutionNotes] = useState(existingResolutionNotes ?? '')
  const [geoStatus, setGeoStatus] = useState<'idle' | 'locating' | 'ok' | 'denied'>('idle')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Set up canvas + geolocation on open
  useEffect(() => {
    if (!open) return
    setResolutionNotes(existingResolutionNotes ?? '')
    setHasInk(false)
    setError(null)

    // Fire geolocation request in the background
    if ('geolocation' in navigator) {
      setGeoStatus('locating')
      navigator.geolocation.getCurrentPosition(
        pos => {
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
          setGeoStatus('ok')
        },
        () => setGeoStatus('denied'),
        { enableHighAccuracy: true, timeout: 10000 }
      )
    }

    // Initialize canvas after DOM settles
    const t = setTimeout(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * window.devicePixelRatio
      canvas.height = rect.height * window.devicePixelRatio
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        ctx.strokeStyle = '#0f172a'
      }
    }, 50)
    return () => clearTimeout(t)
  }, [open, existingResolutionNotes])

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function handleDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrawing(true)
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = pointerPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function handleMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = pointerPos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    if (!hasInk) setHasInk(true)
  }

  function handleUp() {
    setDrawing(false)
  }

  function clearSignature() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasInk(false)
  }

  async function submit() {
    if (!hasInk) { setError('Customer signature required.'); return }
    if (resolutionNotes.trim().length < 10) { setError('Resolution notes must be at least 10 characters.'); return }

    setSubmitting(true)
    setError(null)

    const canvas = canvasRef.current!
    const sigData = canvas.toDataURL('image/png')

    // 1. PATCH ticket with completion capture + resolution notes
    const patchRes = await fetch(`/api/org/psa/tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resolution_notes: resolutionNotes,
        completion_signature_data: sigData,
        completion_lat: coords?.lat ?? null,
        completion_lng: coords?.lng ?? null,
        completion_captured_at: new Date().toISOString(),
      }),
    })
    if (!patchRes.ok) {
      setSubmitting(false)
      const e = await patchRes.json().catch(() => ({}))
      setError(e.error ?? 'Failed to save completion data')
      return
    }

    // 2. Fire the COMPLETED → RESOLVED transition
    const transitionRes = await fetch(`/api/org/psa/tickets/${ticketId}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to_status: 'RESOLVED' }),
    })
    setSubmitting(false)

    if (!transitionRes.ok) {
      const e = await transitionRes.json().catch(() => ({}))
      const gateMsg = Array.isArray(e.gate_failures) ? ` (${e.gate_failures.join('; ')})` : ''
      setError(`${e.error ?? 'Transition failed'}${gateMsg}`)
      return
    }

    onComplete()
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg bg-white rounded-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-200">
          <div className="text-sm font-semibold text-neutral-900">Complete &amp; Resolve Ticket</div>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-neutral-900">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Resolution notes */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">Resolution Notes *</label>
            <textarea
              value={resolutionNotes}
              onChange={e => setResolutionNotes(e.target.value)}
              rows={4}
              placeholder="Describe what was done (min 10 characters)"
              className="w-full px-3 py-2 border border-neutral-300 rounded text-sm font-sans"
            />
          </div>

          {/* Signature pad */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-neutral-700">Customer Signature *</label>
              <button
                type="button"
                onClick={clearSignature}
                className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900"
              >
                <Eraser className="w-3 h-3" /> Clear
              </button>
            </div>
            <div className="relative border-2 border-dashed border-neutral-300 rounded-md bg-neutral-50 touch-none">
              <canvas
                ref={canvasRef}
                className="w-full h-40 block"
                onPointerDown={handleDown}
                onPointerMove={handleMove}
                onPointerUp={handleUp}
                onPointerCancel={handleUp}
                onPointerLeave={handleUp}
              />
              {!hasInk && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-neutral-400">
                  Sign here with finger or stylus
                </div>
              )}
            </div>
          </div>

          {/* Geo status */}
          <div className="flex items-center gap-2 text-xs">
            <MapPin className="w-3.5 h-3.5 text-neutral-400" />
            {geoStatus === 'idle' && <span className="text-neutral-500">Location not captured</span>}
            {geoStatus === 'locating' && <span className="text-neutral-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Capturing location…</span>}
            {geoStatus === 'ok' && coords && (
              <span className="text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </span>
            )}
            {geoStatus === 'denied' && <span className="text-amber-600">Location unavailable (optional)</span>}
          </div>

          {error && (
            <div className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-neutral-200 bg-neutral-50">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-1.5 text-sm text-neutral-700 hover:text-neutral-900"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 text-white rounded text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            {submitting ? 'Saving…' : 'Resolve Ticket'}
          </button>
        </div>
      </div>
    </div>
  )
}
