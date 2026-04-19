'use client'

import { useState } from 'react'
import { Download, FileText } from 'lucide-react'
import { toast } from 'sonner'

export interface VaultItem {
  id: string
  vault_id: string
  folder_id: string | null
  item_type: string
  name: string
  file_url: string | null
  version: number
  sort_order: number
  metadata: Record<string, unknown> | null
  created_at: string
}

interface Props { items: VaultItem[] }

function sourceLabel(metadata: VaultItem['metadata']) {
  const source = metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>).source : null
  switch (source) {
    case 'google_drive': return 'Google Drive'
    case 'dropbox': return 'Dropbox'
    case 'onedrive': return 'OneDrive'
    case 'icloud': return 'iCloud Drive'
    case 'usb_drive': return 'USB Drive'
    case 'folder_path': return 'Folder Path'
    case 'local_device': return 'Local Device'
    default: return '—'
  }
}

export function VaultItemsTable({ items }: Props) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  async function downloadItem(item: VaultItem) {
    if (!item.id || !item.file_url) return
    setDownloadingId(item.id)
    try {
      const res = await fetch(`/api/org/vault-items/${item.id}/signed-url`)
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error ?? 'Download failed')
      window.open(payload.signedUrl, '_blank', 'noopener,noreferrer')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Download failed')
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Name</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Type</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Source</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Version</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/30">
              <td className="px-4 py-2 font-medium flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                {item.name || '—'}
              </td>
              <td className="px-4 py-2 text-muted-foreground">{item.item_type || '—'}</td>
              <td className="px-4 py-2 text-muted-foreground">{sourceLabel(item.metadata)}</td>
              <td className="px-4 py-2 text-muted-foreground">V{item.version ?? 1}</td>
              <td className="px-4 py-2">
                <button
                  type="button"
                  disabled={!item.file_url || downloadingId === item.id}
                  onClick={() => downloadItem(item)}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs hover:bg-accent/40 disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
