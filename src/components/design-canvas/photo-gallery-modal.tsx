'use client'

import { useState, useCallback, useRef } from 'react'
import { C } from './constants'
import { X, Upload, Camera, Maximize2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'

export interface DevicePhoto {
  id: string
  deviceId: string
  url: string
  caption: string
  timestamp: number
  /** Data URL for local uploads (before Supabase sync) */
  dataUrl?: string
}

interface PhotoGalleryModalProps {
  photos: DevicePhoto[]
  initialIndex?: number
  onClose: () => void
  onDelete?: (photoId: string) => void
  onCaptionChange?: (photoId: string, caption: string) => void
}

interface PhotoSectionProps {
  deviceId: string
  photos: DevicePhoto[]
  onAddPhoto?: (deviceId: string, file: File) => void
  onDeletePhoto?: (photoId: string) => void
  onCaptionChange?: (photoId: string, caption: string) => void
  onViewFullscreen?: (index: number) => void
}

/**
 * Full-screen photo gallery modal with navigation
 */
export function PhotoGalleryModal({ photos, initialIndex = 0, onClose, onDelete, onCaptionChange }: PhotoGalleryModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [editingCaption, setEditingCaption] = useState(false)
  const photo = photos[currentIndex]

  if (!photo) return null

  const prev = () => setCurrentIndex((i) => (i > 0 ? i - 1 : photos.length - 1))
  const next = () => setCurrentIndex((i) => (i < photos.length - 1 ? i + 1 : 0))

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.9)',
        display: 'flex', flexDirection: 'column', 
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 16, right: 16,
          background: 'rgba(255,255,255,0.1)', border: 'none',
          borderRadius: 8, padding: 8, cursor: 'pointer', color: '#fff',
          zIndex: 101,
        }}
      >
        <X size={20} />
      </button>

      {/* Navigation */}
      {photos.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); prev() }}
            style={{
              position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
              background: 'rgba(255,255,255,0.1)', border: 'none',
              borderRadius: 8, padding: '12px 8px', cursor: 'pointer', color: '#fff',
              zIndex: 101,
            }}
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next() }}
            style={{
              position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
              background: 'rgba(255,255,255,0.1)', border: 'none',
              borderRadius: 8, padding: '12px 8px', cursor: 'pointer', color: '#fff',
              zIndex: 101,
            }}
          >
            <ChevronRight size={24} />
          </button>
        </>
      )}

      {/* Image */}
      <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '85vw', maxHeight: '75vh' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.dataUrl || photo.url}
          alt={photo.caption || 'Device photo'}
          style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', borderRadius: 8 }}
        />
      </div>

      {/* Info bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          marginTop: 16, padding: '10px 20px',
          background: 'rgba(255,255,255,0.05)', borderRadius: 8,
          display: 'flex', alignItems: 'center', gap: 12, minWidth: 300,
        }}
      >
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
          {currentIndex + 1} / {photos.length}
        </span>
        {editingCaption ? (
          <input
            autoFocus
            defaultValue={photo.caption}
            onBlur={(e) => {
              onCaptionChange?.(photo.id, e.target.value)
              setEditingCaption(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onCaptionChange?.(photo.id, e.currentTarget.value)
                setEditingCaption(false)
              }
            }}
            style={{
              flex: 1, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 4, padding: '4px 8px', color: '#fff', fontSize: 12,
              fontFamily: 'inherit', outline: 'none',
            }}
          />
        ) : (
          <span
            onClick={() => setEditingCaption(true)}
            style={{ flex: 1, fontSize: 12, color: photo.caption ? '#fff' : 'rgba(255,255,255,0.3)', cursor: 'pointer' }}
          >
            {photo.caption || 'Click to add caption...'}
          </span>
        )}
        {onDelete && (
          <button
            onClick={() => { onDelete(photo.id); if (currentIndex >= photos.length - 1) setCurrentIndex(Math.max(0, currentIndex - 1)) }}
            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Thumbnail strip */}
      {photos.length > 1 && (
        <div style={{
          marginTop: 12, display: 'flex', gap: 6, overflowX: 'auto',
          padding: '4px 20px', maxWidth: '90vw',
        }}>
          {photos.map((p, i) => (
            <div
              key={p.id}
              onClick={(e) => { e.stopPropagation(); setCurrentIndex(i) }}
              style={{
                width: 48, height: 48, borderRadius: 4, overflow: 'hidden',
                border: i === currentIndex ? '2px solid #3b82f6' : '2px solid transparent',
                cursor: 'pointer', flexShrink: 0, opacity: i === currentIndex ? 1 : 0.5,
                transition: 'opacity 0.2s',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.dataUrl || p.url}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Photo section for the right panel — 3-column thumbnail grid with upload
 */
export function PhotoSection({ deviceId, photos, onAddPhoto, onDeletePhoto, onCaptionChange, onViewFullscreen }: PhotoSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const devicePhotos = photos.filter(p => p.deviceId === deviceId)

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        onAddPhoto?.(deviceId, file)
      }
    }
    e.target.value = '' // Reset input
  }, [deviceId, onAddPhoto])

  return (
    <div>
      {/* Upload button */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            flex: 1, padding: '6px 0', background: C.bgActive, border: `1px dashed ${C.border}`,
            borderRadius: 4, cursor: 'pointer', fontSize: 10, fontWeight: 600,
            color: C.accent, fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          }}
        >
          <Upload size={11} /> Upload Photo
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>

      {/* Thumbnail grid — 3 columns */}
      {devicePhotos.length === 0 ? (
        <div style={{ padding: '12px 0', textAlign: 'center', fontSize: 10, color: C.textDim }}>
          No photos. Upload site survey images for this device.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
          {devicePhotos.map((photo, i) => (
            <div
              key={photo.id}
              style={{
                position: 'relative', aspectRatio: '1', borderRadius: 4,
                overflow: 'hidden', cursor: 'pointer',
                border: `1px solid ${C.borderSubtle}`,
              }}
              onClick={() => onViewFullscreen?.(i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.dataUrl || photo.url}
                alt={photo.caption || 'Device photo'}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              {/* Hover overlay */}
              <div
                style={{
                  position: 'absolute', inset: 0,
                  background: 'rgba(0,0,0,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: 0, transition: 'opacity 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
              >
                <Maximize2 size={14} color="#fff" />
              </div>
              {/* Caption strip */}
              {photo.caption && (
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'rgba(0,0,0,0.6)', padding: '2px 4px',
                  fontSize: 7, color: '#fff', overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {photo.caption}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 8, color: C.textDim, marginTop: 4 }}>
        {devicePhotos.length} photo{devicePhotos.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
