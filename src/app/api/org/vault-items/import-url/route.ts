import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { uploadVaultFile } from '@/lib/supabase/vault-storage'
import type { CloudSource } from '@/lib/cloud-sources'

const MAX_IMPORT_BYTES = 100 * 1024 * 1024
const FETCH_TIMEOUT_MS = 30000

const ALLOWED_HOSTS: Record<CloudSource, string[]> = {
  google_drive: ['drive.google.com', 'docs.google.com', 'storage.googleapis.com', 'googleusercontent.com'],
  dropbox: ['dropbox.com', 'dropboxusercontent.com'],
  onedrive: ['onedrive.live.com', '1drv.ms', 'sharepoint.com'],
  icloud: ['icloud.com', 'icloud-content.com'],
  usb_drive: [], folder_path: [], local_device: [],
}

function hostAllowed(host: string, src: CloudSource) {
  const h = host.toLowerCase()
  return (ALLOWED_HOSTS[src] ?? []).some(c => h === c || h.endsWith(`.${c}`))
}

function normalizeUrl(u: URL, src: CloudSource) {
  const n = new URL(u.toString())
  if (src === 'dropbox') { n.searchParams.set('dl', '1'); return n.toString() }
  if (src === 'google_drive') {
    const m = n.pathname.match(/\/file\/d\/([^/]+)/)
    if (m?.[1]) return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(m[1])}`
  }
  return n.toString()
}

function nameFromUrl(u: URL) {
  const seg = u.pathname.split('/').filter(Boolean).pop()
  return seg ? decodeURIComponent(seg) : null
}

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').trim() || 'file'
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: dbUser } = await admin.from('users').select('id, org_id').eq('auth_id', user.id).single()
  if (!dbUser?.org_id) return NextResponse.json({ error: 'No org context' }, { status: 403 })

  let body: { vaultId?: string; folderId?: string | null; source?: CloudSource; fileUrl?: string; fileName?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const vaultId = body.vaultId?.trim() ?? ''
  const folderId = body.folderId?.trim() || null
  const source = body.source ?? 'google_drive'
  const rawUrl = body.fileUrl?.trim() ?? ''

  if (!vaultId || !rawUrl) return NextResponse.json({ error: 'vaultId and fileUrl are required' }, { status: 400 })
  if (!['google_drive', 'dropbox', 'onedrive', 'icloud'].includes(source)) {
    return NextResponse.json({ error: 'invalid source' }, { status: 400 })
  }

  let parsed: URL
  try { parsed = new URL(rawUrl) } catch { return NextResponse.json({ error: 'fileUrl must be valid URL' }, { status: 400 }) }
  if (parsed.protocol !== 'https:') return NextResponse.json({ error: 'fileUrl must use https' }, { status: 400 })
  if (!hostAllowed(parsed.hostname, source)) return NextResponse.json({ error: `Host not allowed for ${source}` }, { status: 400 })

  const { data: vault } = await admin
    .from('document_vaults').select('id')
    .eq('id', vaultId).eq('org_id', dbUser.org_id).single()
  if (!vault) return NextResponse.json({ error: 'Vault not found' }, { status: 404 })

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  let remote: Response
  try {
    remote = await fetch(normalizeUrl(parsed, source), { redirect: 'follow', signal: ctrl.signal })
  } catch {
    clearTimeout(t); return NextResponse.json({ error: 'Failed to fetch remote URL' }, { status: 502 })
  }
  clearTimeout(t)
  if (!remote.ok) return NextResponse.json({ error: `Remote fetch failed (${remote.status})` }, { status: 502 })

  const cl = Number(remote.headers.get('content-length') || 0)
  if (cl > MAX_IMPORT_BYTES) return NextResponse.json({ error: 'Remote exceeds 100MB limit' }, { status: 413 })

  const bytes = await remote.arrayBuffer()
  if (bytes.byteLength === 0) return NextResponse.json({ error: 'Remote file empty' }, { status: 400 })
  if (bytes.byteLength > MAX_IMPORT_BYTES) return NextResponse.json({ error: 'Remote exceeds 100MB limit' }, { status: 413 })

  const contentType = remote.headers.get('content-type') || 'application/octet-stream'
  const name = sanitize(body.fileName?.trim() || nameFromUrl(parsed) || `${source}_import`)
  const { storagePath } = await uploadVaultFile(bytes, dbUser.org_id, vaultId, name, contentType)

  const { data: item, error } = await admin
    .from('vault_items')
    .insert({
      vault_id: vaultId, folder_id: folderId, item_type: 'uploaded',
      name, file_url: storagePath,
      metadata: { source, import_url: parsed.toString(), content_type: contentType, size_bytes: bytes.byteLength },
      created_by: dbUser.id,
    })
    .select('*').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item }, { status: 201 })
}
