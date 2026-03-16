import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyDesignAccess } from '@/lib/auth'

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
      const storagePath = fp.file_url as string | null
      if (!storagePath) return { ...fp, file_url: null }

      // If it's already an https URL (legacy), pass through
      if (storagePath.startsWith('http')) return fp

      // Generate signed URL (1 hour expiry — refreshed on each page load)
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

  // Validate file type
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const allowedExts = ['png', 'jpg', 'jpeg', 'svg', 'pdf']
  if (!allowedExts.includes(ext)) {
    return NextResponse.json({ error: `File type .${ext} not supported. Use PNG, JPG, SVG, or PDF.` }, { status: 400 })
  }

  const mimeMap: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    svg: 'image/svg+xml', pdf: 'application/pdf',
  }

  // Upload to Supabase Storage
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

  // Store the STORAGE PATH (not a URL) — signed URL generated on GET
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

  // Return with signed URL for immediate use
  const { data: signedData } = await admin.storage
    .from('org-assets')
    .createSignedUrl(storagePath, 3600)

  return NextResponse.json({
    floorPlan: { ...fp, file_url: signedData?.signedUrl ?? null },
  }, { status: 201 })
}
