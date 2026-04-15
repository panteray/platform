'use client'

// BarcodeScanner — modal wrapper around @zxing/browser.
// Opens the rear camera, scans a barcode/QR code, calls onDetected(code), closes.
// Lazy-loads the zxing library so it only ships when a tech actually scans.

import { useEffect, useRef, useState } from 'react'
import { X, ScanLine, AlertCircle } from 'lucide-react'

type Props = {
  open: boolean
  onClose: () => void
  onDetected: (code: string) => void
}

export function BarcodeScanner({ open, onClose, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    setReady(false)

    let cancelled = false
    // Track controls so we can stop the stream on cleanup.
    type Controls = { stop: () => void }
    let controls: Controls | null = null

    ;(async () => {
      try {
        const zxing = await import('@zxing/browser')
        if (cancelled) return
        const reader = new zxing.BrowserMultiFormatReader()
        const devices = await zxing.BrowserMultiFormatReader.listVideoInputDevices()
        const back = devices.find(d => /back|rear|environment/i.test(d.label)) ?? devices[0]
        if (!back) {
          setError('No camera available')
          return
        }
        if (!videoRef.current) return
        const c = await reader.decodeFromVideoDevice(back.deviceId, videoRef.current, (result) => {
          if (result) {
            onDetected(result.getText())
            controls?.stop()
            onClose()
          }
        })
        controls = c as Controls
        setReady(true)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Camera unavailable')
      }
    })()

    return () => {
      cancelled = true
      controls?.stop()
    }
  }, [open, onClose, onDetected])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80">
      <div className="relative w-full max-w-md bg-neutral-900 rounded-lg overflow-hidden border border-neutral-700">
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <ScanLine className="w-4 h-4 text-emerald-400" />
            Scan barcode or QR
          </div>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="relative aspect-square bg-black">
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
          {!ready && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-400">
              Starting camera…
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
              <AlertCircle className="w-6 h-6 text-red-400" />
              <div className="text-xs text-red-300">{error}</div>
              <div className="text-[10px] text-neutral-500">Requires HTTPS and camera permission.</div>
            </div>
          )}
          {ready && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="w-2/3 aspect-square border-2 border-emerald-400/60 rounded-lg" />
            </div>
          )}
        </div>
        <div className="px-4 py-2 text-[10px] text-neutral-500 text-center">
          Aim camera at code — auto-detects
        </div>
      </div>
    </div>
  )
}
