'use client'

import { useState, useRef } from 'react'
import { Camera, Upload, X, Loader2, Check, RotateCcw } from 'lucide-react'

interface LeadCardScannerProps {
  onScanComplete: (data: Record<string, string | null>) => void
  onClose: () => void
}

type Step = 'capture' | 'scanning' | 'review' | 'error'

const FIELD_LABELS: Record<string, string> = {
  first_name: 'First Name',
  last_name: 'Last Name',
  title: 'Title',
  company: 'Company',
  email: 'Email',
  phone: 'Phone',
  mobile: 'Mobile',
  address: 'Address',
  city: 'City',
  state: 'State',
  zip: 'ZIP',
  website: 'Website',
}

export function LeadCardScanner({ onScanComplete, onClose }: LeadCardScannerProps) {
  const [step, setStep] = useState<Step>('capture')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [parsed, setParsed] = useState<Record<string, string | null>>({})
  const [rawText, setRawText] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  async function compressImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const maxDim = 1600
          let w = img.width
          let h = img.height
          if (w > maxDim || h > maxDim) {
            const ratio = Math.min(maxDim / w, maxDim / h)
            w = Math.round(w * ratio)
            h = Math.round(h * ratio)
          }
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d')
          if (!ctx) { reject(new Error('Canvas context failed')); return }
          ctx.drawImage(img, 0, 0, w, h)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
          resolve(dataUrl)
        }
        img.onerror = () => reject(new Error('Image load failed'))
        img.src = reader.result as string
      }
      reader.onerror = () => reject(new Error('File read failed'))
      reader.readAsDataURL(file)
    })
  }

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select an image file.')
      setStep('error')
      return
    }

    try {
      const compressed = await compressImage(file)
      setImagePreview(compressed)
      setStep('scanning')

      const res = await fetch('/api/org/leads/card-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: compressed }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'OCR failed' }))
        setErrorMsg(err.error ?? 'OCR processing failed')
        setStep('error')
        return
      }

      const data = await res.json()
      setRawText(data.raw ?? '')
      setParsed(data.parsed ?? {})
      setStep('review')
    } catch {
      setErrorMsg('Failed to process image')
      setStep('error')
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function updateField(key: string, value: string) {
    setParsed((prev) => ({ ...prev, [key]: value || null }))
  }

  function handleConfirm() {
    onScanComplete(parsed)
  }

  function handleRetry() {
    setStep('capture')
    setImagePreview(null)
    setParsed({})
    setRawText('')
    setErrorMsg('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h3 className="text-sm font-semibold">
            {step === 'capture' && 'Scan Business Card'}
            {step === 'scanning' && 'Processing...'}
            {step === 'review' && 'Review Scanned Data'}
            {step === 'error' && 'Scan Error'}
          </h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {/* CAPTURE STEP */}
          {step === 'capture' && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Take a photo or upload an image of a business card. The text will be
                automatically extracted and you can review before creating a lead.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-6 hover:border-primary/40 hover:bg-muted/30 transition-colors"
                >
                  <Camera className="h-8 w-8 text-muted-foreground" />
                  <span className="text-xs font-medium">Take Photo</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-6 hover:border-primary/40 hover:bg-muted/30 transition-colors"
                >
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <span className="text-xs font-medium">Upload Image</span>
                </button>
              </div>

              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          )}

          {/* SCANNING STEP */}
          {step === 'scanning' && (
            <div className="flex flex-col items-center gap-4 py-8">
              {imagePreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imagePreview}
                  alt="Business card"
                  className="h-40 rounded-lg border border-border object-contain"
                />
              )}
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  Extracting text from card...
                </span>
              </div>
            </div>
          )}

          {/* REVIEW STEP */}
          {step === 'review' && (
            <div className="space-y-4">
              {/* Card preview */}
              {imagePreview && (
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
                    alt="Business card"
                    className="h-32 rounded-lg border border-border object-contain"
                  />
                </div>
              )}

              {/* Editable fields */}
              <div className="grid grid-cols-2 gap-2.5">
                {Object.entries(FIELD_LABELS).map(([key, label]) => (
                  <div key={key} className={key === 'address' ? 'col-span-2' : ''}>
                    <label className="mb-0.5 block text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      {label}
                    </label>
                    <input
                      type="text"
                      value={parsed[key] ?? ''}
                      onChange={(e) => updateField(key, e.target.value)}
                      className="h-8 w-full rounded-md border border-border bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                ))}
              </div>

              {/* Raw OCR text (collapsible) */}
              {rawText && (
                <details className="rounded-md border border-border">
                  <summary className="cursor-pointer px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted">
                    Raw OCR Output
                  </summary>
                  <pre className="max-h-32 overflow-auto whitespace-pre-wrap px-3 py-2 text-[11px] text-muted-foreground">
                    {rawText}
                  </pre>
                </details>
              )}
            </div>
          )}

          {/* ERROR STEP */}
          {step === 'error' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="rounded-full bg-red-500/10 p-3">
                <X className="h-6 w-6 text-red-500" />
              </div>
              <p className="text-sm text-muted-foreground">{errorMsg}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          {step === 'capture' && (
            <button
              onClick={onClose}
              className="h-8 rounded-md border border-border px-4 text-xs hover:bg-muted"
            >
              Cancel
            </button>
          )}

          {step === 'review' && (
            <>
              <button
                onClick={handleRetry}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs hover:bg-muted"
              >
                <RotateCcw className="h-3 w-3" /> Rescan
              </button>
              <button
                onClick={handleConfirm}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Check className="h-3 w-3" /> Create Lead
              </button>
            </>
          )}

          {step === 'error' && (
            <>
              <button
                onClick={onClose}
                className="h-8 rounded-md border border-border px-4 text-xs hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleRetry}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                <RotateCcw className="h-3 w-3" /> Try Again
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
