import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ChangeOrderPhoto } from '@/types/database'

const BUCKET = 'change-order-photos'
const MAX_BYTES = 25 * 1024 * 1024 // 25 MB
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

async function loadCo(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  projectId: string,
  coId: string,
) {
  return admin
    .from('change_orders')
    .select('id')
    .eq('id', coId)
    .eq('project_id', projectId)
    .eq('org_id', orgId)
    .maybeSingle<{ id: string }>()
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; coId: string }> }
) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: projectId, coId } = await params
  const admin = createAdminClient()

  const { data: co } = await loadCo(admin, caller.org_id, projectId, coId)
  if (!co) return NextResponse.json({ error: 'CO not found' }, { status: 404 })

  const { data: photos, error } = await admin
    .from('change_order_photos')
    .select('*')
    .eq('change_order_id', coId)
    .eq('org_id', caller.org_id)
    .order('uploaded_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const rows = (photos ?? []) as ChangeOrderPhoto[]
  const withUrls = await Promise.all(rows.map(async (p) => {
    const { data: signed } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(p.storage_path, 3600)
    return { ...p, url: signed?.signedUrl ?? null }
  }))
  return NextResponse.json(withUrls)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; coId: string }> }
) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: projectId, coId } = await params
  const admin = createAdminClient()

  const { data: co } = await loadCo(admin, caller.org_id, projectId, coId)
  if (!co) return NextResponse.json({ error: 'CO not found' }, { status: 404 })

  const form = await req.formData()
  const file = form.get('file')
  const caption = (form.get('caption') as string | null)?.trim() || null

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 })
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: `Unsupported mime type: ${file.type}` }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds 25 MB' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const storagePath = `${caller.org_id}/${coId}/${filename}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })
  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  const { data: row, error: insertErr } = await admin
    .from('change_order_photos')
    .insert({
      org_id: caller.org_id,
      change_order_id: coId,
      storage_path: storagePath,
      mime_type: file.type,
      byte_size: buffer.byteLength,
      caption,
      uploaded_by: caller.id,
    })
    .select('*')
    .single<ChangeOrderPhoto>()
  if (insertErr || !row) {
    await admin.storage.from(BUCKET).remove([storagePath])
    return NextResponse.json({ error: insertErr?.message ?? 'Insert failed' }, { status: 500 })
  }

  const { data: signed } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600)
  return NextResponse.json({ ...row, url: signed?.signedUrl ?? null }, { status: 201 })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; coId: string }> }
) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: projectId, coId } = await params
  const photoId = req.nextUrl.searchParams.get('photo_id')
  if (!photoId) return NextResponse.json({ error: 'photo_id required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: co } = await loadCo(admin, caller.org_id, projectId, coId)
  if (!co) return NextResponse.json({ error: 'CO not found' }, { status: 404 })

  const { data: photo, error: loadErr } = await admin
    .from('change_order_photos')
    .select('id, storage_path, uploaded_by')
    .eq('id', photoId)
    .eq('change_order_id', coId)
    .eq('org_id', caller.org_id)
    .maybeSingle<{ id: string; storage_path: string; uploaded_by: string | null }>()
  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 })
  if (!photo) return NextResponse.json({ error: 'Photo not found' }, { status: 404 })

  const isUploader = photo.uploaded_by === caller.id
  const isAdmin = caller.is_global_admin || caller.role === 'ORG_ADMIN' || caller.role === 'ORG_MANAGER'
  if (!isUploader && !isAdmin) {
    return NextResponse.json({ error: 'Only the uploader or an admin can delete this photo' }, { status: 403 })
  }

  await admin.storage.from(BUCKET).remove([photo.storage_path])
  const { error: deleteErr } = await admin
    .from('change_order_photos')
    .delete()
    .eq('id', photoId)
    .eq('org_id', caller.org_id)
  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 })

  return NextResponse.json({ deleted: true })
}
