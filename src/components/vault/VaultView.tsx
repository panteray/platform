'use client'

import { useEffect, useState } from 'react'
import { FolderOpen } from 'lucide-react'
import { VaultFolderTree } from './VaultFolderTree'
import { VaultItemsTable, type VaultItem } from './VaultItemsTable'
import { VaultUploadMenu } from './VaultUploadMenu'

interface Props {
  vaultId: string | null
  emptyTitle?: string
  emptyDescription?: string
}

export function VaultView({ vaultId, emptyTitle = 'Vault is empty', emptyDescription = 'Documents will appear here once uploaded or generated' }: Props) {
  const [items, setItems] = useState<VaultItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)

  useEffect(() => {
    if (!vaultId) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    fetch(`/api/org/vault-items?vault_id=${vaultId}`)
      .then(r => r.ok ? r.json() : { items: [] })
      .then(({ items }) => { if (!cancelled) setItems(items ?? []) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [vaultId])

  if (!vaultId) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <FolderOpen className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm font-medium">{emptyTitle}</p>
        <p className="text-xs text-muted-foreground mt-1">{emptyDescription}</p>
      </div>
    )
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading vault...</p>

  const filtered = selectedFolderId === null ? items : items.filter(i => i.folder_id === selectedFolderId)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <VaultUploadMenu
          vaultId={vaultId}
          folderId={selectedFolderId}
          onUploaded={(item) => setItems(prev => [item, ...prev])}
        />
      </div>

      <div className="flex gap-4">
        <div className="w-56 shrink-0 rounded-lg border border-border bg-card p-2">
          <VaultFolderTree
            vaultId={vaultId}
            selectedFolderId={selectedFolderId}
            onSelectFolder={setSelectedFolderId}
          />
        </div>

        <div className="flex-1 min-w-0">
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <FolderOpen className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {selectedFolderId ? 'This folder is empty' : 'No documents yet'}
              </p>
            </div>
          ) : (
            <VaultItemsTable items={filtered} />
          )}
        </div>
      </div>
    </div>
  )
}
