import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyDesignAccess } from '@/lib/auth'

// Extract storage path from a public URL or return as-is if already a path
function extractStoragePath(fileUrl: string): string {
  // Already a storage path (no http)
  if (!fileUrl.startsWith('http')) return fileUrl
  // Public URL format: {supabase_url}/storage/v1/object/public/{bucket}/{path}
  const publicMatch = fileUrl.match(/\/storage\/v1\/object\/public\/org-assets\/(.+)/)
  if (publicMatch) return publicMatch[1]
  // Signed URL format: {supabase_url}/storage/v1/object/sign/org-assets/{path}?token=...
  const signedMatch = fileUrl.match(/\/storage\/v1\/object\/sign\/org-assets\/([^?]+)/)
  if (signedMatch) return signedMatch[1]
  // Can't parse — return empty
  return ''
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyDesignAccess()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: designId } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('design_floor_plans')
    .select('*')
    .eq('design_id', designId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Generate signed URLs for each floor plan
  const floorPlans = await Promise.all(
    (data ?? []).map(async (fp) => {
      const raw = fp.file_url as string | null
      if (!raw) return { ...fp, file_url: null }

      const storagePath = extractStoragePath(raw)
      if (!storagePath) return { ...fp, file_url: null }

      const { data: signedData, error: signedErr } = await admin.storage
        .from('org-assets')
        .createSignedUrl(storagePath, 3600)

      if (signedErr || !signedData?.signedUrl) {
        return { ...fp, file_url: null }
      }

      return { ...fp, file_url: signedData.signedUrl }
    })
  )

  return NextResponse.json({ floorPlans })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyDesignAccess()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: designId } = await params
  const admin = createAdminClient()

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const areaId = formData.get('area_id') as string | null

  if (!file || !areaId) {
    return NextResponse.json({ error: 'file and area_id required' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const allowedExts = ['png', 'jpg', 'jpeg', 'svg', 'pdf']
  if (!allowedExts.includes(ext)) {
    return NextResponse.json({ error: `File type .${ext} not supported. Use PNG, JPG, SVG, or PDF.` }, { status: 400 })
  }

  const mimeMap: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    svg: 'image/svg+xml', pdf: 'application/pdf',
  }

  const storagePath = `designs/${designId}/${areaId}/floor-plan-${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await admin.storage
    .from('org-assets')
    .upload(storagePath, buffer, {
      contentType: mimeMap[ext] || file.type || 'application/octet-stream',
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 400 })
  }

  // Store the STORAGE PATH — signed URL generated on GET
  const { data: fp, error: fpError } = await admin
    .from('design_floor_plans')
    .insert({
      design_id: designId,
      area_id: areaId,
      file_url: storagePath,
      opacity: 1.0,
    })
    .select()
    .single()

  if (fpError) {
    return NextResponse.json({ error: fpError.message }, { status: 400 })
  }

  // Return with signed URL for immediate rendering
  const { data: signedData } = await admin.storage
    .from('org-assets')
    .createSignedUrl(storagePath, 3600)

  return NextResponse.json({
    floorPlan: { ...fp, file_url: signedData?.signedUrl ?? null },
  }, { status: 201 })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyDesignAccess()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: designId } = await params
  const planId = req.nextUrl.searchParams.get('plan_id')
  if (!planId) return NextResponse.json({ error: 'plan_id required' }, { status: 400 })

  const admin = createAdminClient()

  // Get the floor plan to find storage path
  const { data: fp } = await admin.from('design_floor_plans').select('*').eq('id', planId).eq('design_id', designId).single()
  if (!fp) return NextResponse.json({ error: 'Floor plan not found' }, { status: 404 })

  // Delete storage file
  const storagePath = extractStoragePath(fp.file_url ?? '')
  if (storagePath) {
    await admin.storage.from('org-assets').remove([storagePath])
  }

  // Delete DB record
  const { error } = await admin.from('design_floor_plans').delete().eq('id', planId).eq('design_id', designId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deleted: true })
}
