'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { X, Upload, FileImage, Layers } from 'lucide-react'
import { C } from './constants'

interface FloorPlanUploadResult {
  file: File
  width: number
  height: number
  mode: 'new_area' | 'overlay'
  areaName?: string
}

interface Props {
  onSubmit: (result: FloorPlanUploadResult) => void
  onClose: () => void
  hasActiveArea: boolean
  /** Suggested name for new area (e.g. "Area B") */
  suggestedAreaName: string
}

const ACCEPTED_TYPES = '.pdf,.jpg,.jpeg,.png,.svg'
const ACCEPTED_MIMES = ['image/png', 'image/jpeg', 'image/svg+xml', 'application/pdf']

/** Get image dimensions from a raster/SVG file */
function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      resolve({ width: 1000, height: 800 }) // fallback
      URL.revokeObjectURL(url)
    }
    img.src = url
  })
}

/** Render PDF page 1 to a PNG blob + get dimensions (client-side via pdfjs-dist) */
async function convertPdfToPng(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const pdfjsLib = await import('pdfjs-dist')
  // Set worker source — use CDN to avoid bundling issues
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

  const arrayBuffer = await file.arrayBuffer()
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const page = await doc.getPage(1)

  // Render at 2x scale for quality
  const scale = 2
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height

  const ctx = canvas.getContext('2d')!
  await page.render({ canvasContext: ctx, viewport }).promise

  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b || new Blob()), 'image/png', 0.92)
  })

  return { blob, width: Math.round(viewport.width / scale), height: Math.round(viewport.height / scale) }
}

export function FloorPlanUploadModal({ onSubmit, onClose, hasActiveArea, suggestedAreaName }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [mode, setMode] = useState<'new_area' | 'overlay'>(hasActiveArea ? 'overlay' : 'new_area')
  const [areaName, setAreaName] = useState(suggestedAreaName)
  const [uploading, setUploading] = useState(false)
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null)
  const [convertedFile, setConvertedFile] = useState<File | null>(null)
  const [isPdf, setIsPdf] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }
  }, [previewUrl])

  const handleFile = useCallback(async (f: File) => {
    setError(null)
    const ext = f.name.split('.').pop()?.toLowerCase() || ''
    const isPdfFile = ext === 'pdf' || f.type === 'application/pdf'

    if (!ACCEPTED_MIMES.includes(f.type) && !['pdf', 'svg', 'png', 'jpg', 'jpeg'].includes(ext)) {
      setError('Unsupported file type. Use PDF, JPEG, PNG, or SVG.')
      return
    }

    setFile(f)
    setIsPdf(isPdfFile)

    if (isPdfFile) {
      // Convert PDF → PNG client-side
      try {
        const { blob, width, height } = await convertPdfToPng(f)
        const pngFile = new File([blob], f.name.replace(/\.pdf$/i, '.png'), { type: 'image/png' })
        setConvertedFile(pngFile)
        setDimensions({ width, height })
        setPreviewUrl(URL.createObjectURL(blob))
      } catch (err) {
        console.error('PDF conversion failed:', err)
        setError('Failed to process PDF. Try converting to PNG first.')
        setFile(null)
      }
    } else {
      // Image file — get dimensions directly
      setConvertedFile(null)
      const dims = await getImageDimensions(f)
      setDimensions(dims)
      setPreviewUrl(URL.createObjectURL(f))
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const handleSubmit = useCallback(async () => {
    const uploadFile = convertedFile || file
    if (!uploadFile || !dimensions) return
    setUploading(true)
    try {
      await onSubmit({
        file: uploadFile,
        width: dimensions.width,
        height: dimensions.height,
        mode,
        areaName: mode === 'new_area' ? areaName : undefined,
      })
    } finally {
      setUploading(false)
    }
  }, [file, convertedFile, dimensions, mode, areaName, onSubmit])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div style={{
        width: 440, maxHeight: '90vh', overflow: 'auto',
        background: C.bgPanel, borderRadius: 10, border: `1px solid ${C.border}`,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileImage size={16} style={{ color: C.accent }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Import Floor Plan</span>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', padding: 2,
          }}><X size={16} /></button>
        </div>

        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Drop zone */}
          <div
            ref={dropRef}
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            style={{
              border: `2px dashed ${file ? C.accent : C.border}`,
              borderRadius: 8, padding: file ? 8 : 28,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'border-color 0.2s',
              background: file ? 'transparent' : C.bgActive,
              minHeight: file ? 'auto' : 120,
            }}
          >
            {file && previewUrl ? (
              <div style={{ position: 'relative', width: '100%' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="Floor plan preview"
                  style={{ width: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 4 }} />
                <div style={{
                  position: 'absolute', bottom: 4, right: 4,
                  background: 'rgba(0,0,0,0.7)', color: '#fff',
                  padding: '2px 6px', borderRadius: 3, fontSize: 9,
                }}>
                  {dimensions?.width} × {dimensions?.height}px
                  {isPdf && ' (converted from PDF)'}
                </div>
              </div>
            ) : (
              <>
                <Upload size={24} style={{ color: C.textDim, marginBottom: 8 }} />
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
                  Drop floor plan here or click to browse
                </div>
                <div style={{ fontSize: 10, color: C.textDim, marginTop: 4 }}>
                  PDF, JPEG, PNG, SVG
                </div>
              </>
            )}
            <input ref={inputRef} type="file" accept={ACCEPTED_TYPES} hidden
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          </div>

          {error && (
            <div style={{ fontSize: 11, color: '#ef4444', background: 'rgba(239,68,68,0.08)', padding: '6px 10px', borderRadius: 4 }}>
              {error}
            </div>
          )}

          {/* Mode selection */}
          {file && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Placement
              </div>

              {/* Create new area */}
              <label style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 6,
                border: `1px solid ${mode === 'new_area' ? C.accent : C.border}`,
                background: mode === 'new_area' ? `${C.accent}10` : 'transparent',
                cursor: 'pointer', transition: 'all 0.15s',
              }}>
                <input type="radio" name="mode" checked={mode === 'new_area'}
                  onChange={() => setMode('new_area')}
                  style={{ accentColor: C.accent }} />
                <Layers size={14} style={{ color: mode === 'new_area' ? C.accent : C.textMuted }} />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.text }}>Create new area</div>
                  <div style={{ fontSize: 9, color: C.textDim }}>Separate floor plan tab</div>
                </div>
              </label>

              {/* Overlay on satellite */}
              {hasActiveArea && (
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 6,
                  border: `1px solid ${mode === 'overlay' ? C.accent : C.border}`,
                  background: mode === 'overlay' ? `${C.accent}10` : 'transparent',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  <input type="radio" name="mode" checked={mode === 'overlay'}
                    onChange={() => setMode('overlay')}
                    style={{ accentColor: C.accent }} />
                  <FileImage size={14} style={{ color: mode === 'overlay' ? C.accent : C.textMuted }} />
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.text }}>Overlay on current area</div>
                    <div style={{ fontSize: 9, color: C.textDim }}>Layer on top of satellite image</div>
                  </div>
                </label>
              )}

              {/* Area name input (only for new area) */}
              {mode === 'new_area' && (
                <div style={{ marginTop: 2 }}>
                  <div style={{ fontSize: 9, color: C.textDim, marginBottom: 3 }}>Area Name</div>
                  <input type="text" value={areaName} onChange={e => setAreaName(e.target.value)}
                    placeholder="e.g. Building A - Floor 1"
                    style={{
                      width: '100%', padding: '6px 10px', fontSize: 12,
                      background: C.bgActive, border: `1px solid ${C.border}`,
                      borderRadius: 4, color: C.text, outline: 'none',
                      fontFamily: 'inherit',
                    }} />
                </div>
              )}
            </div>
          )}

          {/* Submit */}
          {file && (
            <button onClick={handleSubmit} disabled={uploading || !dimensions}
              style={{
                width: '100%', padding: '10px 0', fontSize: 12, fontWeight: 700,
                color: '#fff', background: C.accent, border: 'none', borderRadius: 6,
                cursor: uploading ? 'wait' : 'pointer', opacity: uploading ? 0.6 : 1,
                fontFamily: 'inherit', transition: 'opacity 0.15s',
              }}>
              {uploading ? 'Uploading…' : mode === 'new_area' ? 'Create Area & Upload' : 'Upload to Current Area'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
