'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, ChevronDown, Folder, FolderOpen, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface VaultFolder {
  id: string
  vault_id: string
  parent_folder_id: string | null
  name: string
  sort_order: number
  children?: VaultFolder[]
}

interface Props {
  vaultId: string
  selectedFolderId: string | null
  onSelectFolder: (folderId: string | null) => void
  refreshKey?: number
}

function buildTree(folders: VaultFolder[]): VaultFolder[] {
  const map = new Map<string, VaultFolder>()
  const roots: VaultFolder[] = []
  for (const f of folders) map.set(f.id, { ...f, children: [] })
  for (const f of folders) {
    const node = map.get(f.id)!
    if (f.parent_folder_id && map.has(f.parent_folder_id)) map.get(f.parent_folder_id)!.children!.push(node)
    else roots.push(node)
  }
  return roots
}

export function VaultFolderTree({ vaultId, selectedFolderId, onSelectFolder, refreshKey }: Props) {
  const [folders, setFolders] = useState<VaultFolder[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState<string | null>(null)
  const [newName, setNewName] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/org/vaults/${vaultId}/folders`)
    if (res.ok) {
      const json = await res.json()
      setFolders(json.folders ?? [])
    }
  }, [vaultId])

  useEffect(() => { load() }, [load, refreshKey])

  const tree = buildTree(folders)

  async function handleCreate(parentId: string | null) {
    const trimmed = newName.trim()
    if (!trimmed) return
    const res = await fetch(`/api/org/vaults/${vaultId}/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed, parent_id: parentId }),
    })
    if (res.ok) { setCreating(null); setNewName(''); load() }
  }

  async function handleDelete(folderId: string) {
    const res = await fetch(`/api/org/vaults/${vaultId}/folders/${folderId}`, { method: 'DELETE' })
    if (res.ok) {
      if (selectedFolderId === folderId) onSelectFolder(null)
      load()
    }
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function renderNode(node: VaultFolder, depth: number) {
    const isExpanded = expanded.has(node.id)
    const isSelected = selectedFolderId === node.id
    const hasChildren = node.children && node.children.length > 0

    return (
      <div key={node.id}>
        <div
          className={cn(
            'group flex items-center gap-1 rounded-md px-2 py-1 text-sm cursor-pointer hover:bg-muted/60',
            isSelected && 'bg-muted font-medium'
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          <button className="shrink-0 p-0.5 hover:bg-muted rounded" onClick={() => toggleExpand(node.id)}>
            {hasChildren
              ? (isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />)
              : <span className="inline-block w-3.5" />}
          </button>
          <button className="flex items-center gap-1.5 flex-1 min-w-0 text-left" onClick={() => onSelectFolder(node.id)}>
            {isSelected || isExpanded ? <FolderOpen className="h-4 w-4 shrink-0 text-primary" /> : <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />}
            <span className="truncate">{node.name}</span>
          </button>
          <div className="hidden group-hover:flex items-center gap-0.5">
            <button
              className="p-0.5 rounded hover:bg-muted-foreground/20"
              title="New subfolder"
              onClick={(e) => { e.stopPropagation(); setCreating(node.id); setNewName(''); setExpanded(prev => new Set(prev).add(node.id)) }}
            >
              <Plus className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button
              className="p-0.5 rounded hover:bg-destructive/20"
              title="Delete folder"
              onClick={(e) => { e.stopPropagation(); handleDelete(node.id) }}
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {creating === node.id && (
          <div className="flex items-center gap-1 px-2 py-1" style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}>
            <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              className="h-7 flex-1 rounded border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Folder name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate(node.id)
                if (e.key === 'Escape') { setCreating(null); setNewName('') }
              }}
            />
            <button className="h-7 px-2 text-xs rounded hover:bg-muted" onClick={() => handleCreate(node.id)}>Add</button>
          </div>
        )}

        {isExpanded && node.children?.map(child => renderNode(child, depth + 1))}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-2 pb-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Folders</span>
        <button
          className="p-1 rounded hover:bg-muted"
          title="New root folder"
          onClick={() => { setCreating('root'); setNewName('') }}
        >
          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      <button
        className={cn(
          'flex items-center gap-1.5 w-full rounded-md px-2 py-1 text-sm text-left hover:bg-muted/60',
          selectedFolderId === null && 'bg-muted font-medium'
        )}
        onClick={() => onSelectFolder(null)}
      >
        <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span>All Files</span>
      </button>

      {creating === 'root' && (
        <div className="flex items-center gap-1 px-2 py-1">
          <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            className="h-7 flex-1 rounded border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Folder name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate(null)
              if (e.key === 'Escape') { setCreating(null); setNewName('') }
            }}
          />
          <button className="h-7 px-2 text-xs rounded hover:bg-muted" onClick={() => handleCreate(null)}>Add</button>
        </div>
      )}

      {tree.map(node => renderNode(node, 0))}
    </div>
  )
}
