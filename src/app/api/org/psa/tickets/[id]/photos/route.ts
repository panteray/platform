import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'psa-ticket-photos'

/** GET /api/org/psa/tickets/:id/photos */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('psa_ticket_photos')
    .select('*')
    .eq('ticket_id', id)
    .eq('org_id', dbUser.org_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

/** POST /api/org/psa/tickets/:id/photos — upload base64 image → storage → row */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const base64 = body.base64 as string | undefined
  const phase = (body.phase as string | undefined) ?? 'during'
  const caption = (body.caption as string | null | undefined) ?? null

  if (!base64) return NextResponse.json({ error: 'base64 required' }, { status: 400 })
  const matches = base64.match(/^data:image\/(\w+);base64,(.+)$/)
  if (!matches) return NextResponse.json({ error: 'Invalid base64 image' }, { status: 400 })

  const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1]
  const buffer = Buffer.from(matches[2], 'base64')
  const fileName = `${dbUser.org_id}/${id}/${crypto.randomUUID()}.${ext}`

  const admin = createAdminClient()
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(fileName, buffer, { contentType: `image/${matches[1]}`, upsert: false })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(fileName)

  const { data, error } = await admin
    .from('psa_ticket_photos')
    .insert({
      org_id: dbUser.org_id,
      ticket_id: id,
      photo_url: urlData.publicUrl,
      caption,
      phase,
      created_by: dbUser.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

/** DELETE /api/org/psa/tickets/:id/photos?photo_id=... */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await params
  const photoId = req.nextUrl.searchParams.get('photo_id')
  if (!photoId) return NextResponse.json({ error: 'photo_id required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: photo } = await admin
    .from('psa_ticket_photos')
    .select('photo_url')
    .eq('id', photoId)
    .eq('org_id', dbUser.org_id)
    .single()

  if (photo?.photo_url) {
    const parts = photo.photo_url.split(`/${BUCKET}/`)
    if (parts[1]) await admin.storage.from(BUCKET).remove([parts[1]])
  }

  const { error } = await admin
    .from('psa_ticket_photos')
    .delete()
    .eq('id', photoId)
    .eq('org_id', dbUser.org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
