import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'

/** GET /api/org/surveys/:id/photos */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const deviceId = req.nextUrl.searchParams.get('device_id')
  const infraId = req.nextUrl.searchParams.get('infra_id')
  const admin = createAdminClient()

  let q = admin
    .from('survey_photos')
    .select('*')
    .eq('survey_id', id)
    .eq('org_id', dbUser.org_id)
    .order('created_at', { ascending: false })

  if (deviceId) q = q.eq('device_id', deviceId)
  if (infraId) q = q.eq('infra_id', infraId)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/** POST /api/org/surveys/:id/photos — upload photo (base64 → storage) */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const admin = createAdminClient()

  let storageUrl = body.storage_url || null

  // If base64 image provided, upload to survey-photos bucket
  if (body.base64 && !storageUrl) {
    const matches = body.base64.match(/^data:image\/(\w+);base64,(.+)$/)
    if (!matches) return NextResponse.json({ error: 'Invalid base64 image' }, { status: 400 })

    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1]
    const buffer = Buffer.from(matches[2], 'base64')
    const fileName = `${dbUser.org_id}/${id}/${crypto.randomUUID()}.${ext}`

    const { error: uploadError } = await admin.storage
      .from('survey-photos')
      .upload(fileName, buffer, {
        contentType: `image/${matches[1]}`,
        upsert: false,
      })

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

    const { data: urlData } = admin.storage
      .from('survey-photos')
      .getPublicUrl(fileName)

    storageUrl = urlData.publicUrl
  }

  if (!storageUrl) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

  const { data, error } = await admin
    .from('survey_photos')
    .insert({
      survey_id: id,
      device_id: body.device_id || null,
      infra_id: body.infra_id || null,
      org_id: dbUser.org_id,
      storage_url: storageUrl,
      caption: body.caption || null,
      lat: body.lat || null,
      lng: body.lng || null,
      taken_at: body.taken_at || new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

/** DELETE /api/org/surveys/:id/photos?photo_id=... */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await params
  const photoId = req.nextUrl.searchParams.get('photo_id')
  if (!photoId) return NextResponse.json({ error: 'photo_id required' }, { status: 400 })

  const admin = createAdminClient()

  // Get storage path to delete file
  const { data: photo } = await admin
    .from('survey_photos')
    .select('storage_url')
    .eq('id', photoId)
    .eq('org_id', dbUser.org_id)
    .single()

  if (photo?.storage_url) {
    // Extract path from URL — format: .../survey-photos/org_id/survey_id/file.ext
    const urlParts = photo.storage_url.split('/survey-photos/')
    if (urlParts[1]) {
      await admin.storage.from('survey-photos').remove([urlParts[1]])
    }
  }

  const { error } = await admin
    .from('survey_photos')
    .delete()
    .eq('id', photoId)
    .eq('org_id', dbUser.org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
