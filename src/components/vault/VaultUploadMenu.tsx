'use client'

import { useEffect, useRef, useState } from 'react'
import { FolderOpen, HardDriveDownload, Link2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import type { CloudSource } from '@/lib/cloud-sources'
import { CLOUD_SOURCE_LABELS } from '@/lib/cloud-sources'
import type { VaultItem } from './VaultItemsTable'

interface Props {
  vaultId: string
  folderId: string | null
  onUploaded: (item: VaultItem) => void
}

export function VaultUploadMenu({ vaultId, folderId, onUploaded }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const folderInputRef = useRef<HTMLInputElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [localSource, setLocalSource] = useState<CloudSource>('local_device')

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return
      if (!menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  async function uploadFiles(files: FileList | null, source: CloudSource) {
    if (!files || files.length === 0) return
    setBusy(true)
    try {
      for (const file of Array.from(files)) {
        const form = new FormData()
        form.set('file', file)
        form.set('vaultId', vaultId)
        if (folderId) form.set('folderId', folderId)
        form.set('source', source)
        const res = await fetch('/api/org/vault-items/upload', { method: 'POST', body: form })
        const payload = await res.json()
        if (!res.ok) throw new Error(payload.error ?? 'Upload failed')
        onUploaded(payload.item as VaultItem)
      }
      toast.success('Uploaded')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (folderInputRef.current) folderInputRef.current.value = ''
    }
  }

  async function importFromShareLink(source: CloudSource) {
    const url = window.prompt(`Paste ${CLOUD_SOURCE_LABELS[source]} share/download URL`)
    if (!url) return
    const name = window.prompt('Optional file name override (leave empty to auto-detect)') ?? ''
    setBusy(true)
    try {
      const res = await fetch('/api/org/vault-items/import-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vaultId, folderId, source, fileUrl: url, fileName: name || undefined }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error ?? 'Import failed')
      onUploaded(payload.item as VaultItem)
      toast.success('Imported')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  function triggerLocal(source: CloudSource) {
    setLocalSource(source)
    setOpen(false)
    setTimeout(() => fileInputRef.current?.click(), 0)
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40 disabled:opacity-50"
      >
        <Upload className="h-3.5 w-3.5" />
        Upload / Import
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-border bg-card p-1 shadow-lg">
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Local sources</div>
          <button type="button" onClick={() => triggerLocal('local_device')} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent/40">
            <HardDriveDownload className="h-3.5 w-3.5" /> Local Device
          </button>
          <button type="button" onClick={() => triggerLocal('icloud')} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent/40">
            <HardDriveDownload className="h-3.5 w-3.5" /> iCloud Drive
          </button>
          <button type="button" onClick={() => triggerLocal('usb_drive')} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent/40">
            <HardDriveDownload className="h-3.5 w-3.5" /> USB Drive
          </button>
          <button type="button" onClick={() => { setOpen(false); setTimeout(() => folderInputRef.current?.click(), 0) }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent/40">
            <FolderOpen className="h-3.5 w-3.5" /> Folder Path
          </button>

          <div className="my-1 border-t border-border" />

          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Cloud links</div>
          <button type="button" onClick={() => { setOpen(false); importFromShareLink('google_drive') }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent/40">
            <Link2 className="h-3.5 w-3.5" /> Google Drive
          </button>
          <button type="button" onClick={() => { setOpen(false); importFromShareLink('dropbox') }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent/40">
            <Link2 className="h-3.5 w-3.5" /> Dropbox
          </button>
          <button type="button" onClick={() => { setOpen(false); importFromShareLink('onedrive') }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent/40">
            <Link2 className="h-3.5 w-3.5" /> OneDrive
          </button>
        </div>
      )}

      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => uploadFiles(e.currentTarget.files, localSource)} />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        className="hidden"
        {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
        onChange={(e) => uploadFiles(e.currentTarget.files, 'folder_path')}
      />
    </div>
  )
}
