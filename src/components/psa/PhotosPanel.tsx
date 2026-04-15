'use client'

// PhotosPanel — camera capture (front or rear) + before/after phase tagging + upload.
// Uses <input type="file" capture="environment"> which opens native camera on mobile
// and falls back to file picker on desktop. Reads file as base64 and POSTs to the API.

import { useState, useRef } from 'react'
import { Camera, Trash2, Upload } from 'lucide-react'
import type { PsaTicketPhoto } from '@/types/database'

type Props = {
  ticketId: string
  photos: PsaTicketPhoto[]
  onReload: () => void
}

type Phase = 'before' | 'during' | 'after'

const PHASE_COLORS: Record<Phase, string> = {
  before: 'bg-blue-100 text-blue-700 border-blue-200',
  during: 'bg-amber-100 text-amber-700 border-amber-200',
  after:  'bg-emerald-100 text-emerald-700 border-emerald-200',
}

export function PhotosPanel({ ticketId, photos, onReload }: Props) {
  const [phase, setPhase] = useState<Phase>('before')
  const [caption, setCaption] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setError(null)
    setUploading(true)
    try {
      const base64 = await fileToBase64(file)
      const res = await fetch(`/api/org/psa/tickets/${ticketId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, phase, caption: caption || null }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        setError(e.error ?? 'Upload failed')
      } else {
        setCaption('')
        onReload()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function deletePhoto(id: string) {
    if (!confirm('Delete this photo?')) return
    const res = await fetch(`/api/org/psa/tickets/${ticketId}/photos?photo_id=${id}`, {
      method: 'DELETE',
    })
    if (res.ok) onReload()
  }

  return (
    <div className="space-y-4">
      {/* Capture controls */}
      <div className="border border-neutral-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          {(['before', 'during', 'after'] as Phase[]).map(p => (
            <button
              key={p}
              onClick={() => setPhase(p)}
              className={`px-3 py-1.5 text-xs font-semibold uppercase rounded border transition ${
                phase === p ? PHASE_COLORS[p] : 'bg-white text-neutral-500 border-neutral-200 hover:border-neutral-400'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Caption (optional)"
          value={caption}
          onChange={e => setCaption(e.target.value)}
          className="w-full px-3 py-1.5 border border-neutral-300 rounded text-sm"
        />
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            <Camera className="w-4 h-4" />
            {uploading ? 'Uploading…' : 'Take Photo'}
          </button>
          <button
            onClick={() => {
              if (fileRef.current) {
                fileRef.current.removeAttribute('capture')
                fileRef.current.click()
                // restore capture for next take-photo
                setTimeout(() => fileRef.current?.setAttribute('capture', 'environment'), 300)
              }
            }}
            disabled={uploading}
            className="inline-flex items-center gap-2 px-3 py-2 border border-neutral-300 text-neutral-700 rounded text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" /> Pick File
          </button>
        </div>
        {error && <div className="text-xs text-red-600">{error}</div>}
      </div>

      {/* Photo grid */}
      {photos.length === 0 ? (
        <div className="text-center text-sm text-neutral-500 py-8">No photos uploaded</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {photos.map(p => {
            const ph = (p.phase as Phase) ?? 'during'
            const color = PHASE_COLORS[ph] ?? PHASE_COLORS.during
            return (
              <div key={p.id} className="relative border border-neutral-200 rounded overflow-hidden group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.photo_url} alt={p.caption ?? ''} className="w-full h-32 object-cover" />
                <div className="p-2">
                  <span className={`inline-block text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded border ${color}`}>
                    {ph}
                  </span>
                  {p.caption && <div className="text-xs text-neutral-700 mt-1 truncate">{p.caption}</div>}
                </div>
                <button
                  onClick={() => deletePhoto(p.id)}
                  className="absolute top-1 right-1 p-1 bg-white/90 rounded text-red-600 opacity-0 group-hover:opacity-100 transition"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Read failed'))
    reader.readAsDataURL(file)
  })
}
