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
  return NextResponse.json({ floorPlans: data ?? [] })
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

  // Upload to Supabase Storage
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const storagePath = `designs/${designId}/${areaId}/floor-plan-${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await admin.storage
    .from('org-assets')
    .upload(storagePath, buffer, {
      contentType: file.type || 'image/png',
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 })
  }

  // Get public URL
  const { data: urlData } = admin.storage
    .from('org-assets')
    .getPublicUrl(storagePath)

  const fileUrl = urlData?.publicUrl ?? null

  // Insert floor plan record
  const { data: fp, error: fpError } = await admin
    .from('design_floor_plans')
    .insert({
      design_id: designId,
      area_id: areaId,
      file_url: fileUrl,
      opacity: 1.0,
    })
    .select()
    .single()

  if (fpError) {
    return NextResponse.json({ error: fpError.message }, { status: 400 })
  }

  return NextResponse.json({ floorPlan: fp }, { status: 201 })
}
