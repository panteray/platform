import { NextRequest, NextResponse } from 'next/server'
import { verifyDesignAccess } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const TEMPLATE_TYPES = ['rfp_sub', 'sow_sub', 'customer_sow'] as const

export async function GET() {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = createAdminClient()

  // List all templates for this org in storage
  const templates: Array<{ type: string; filename: string; url: string }> = []
  for (const type of TEMPLATE_TYPES) {
    const path = `sow-templates/${user.org_id}/${type}`
    const { data } = await admin.storage.from('org-assets').list(path, { limit: 1, sortBy: { column: 'created_at', order: 'desc' } })
    if (data && data.length > 0) {
      const { data: signed } = await admin.storage.from('org-assets').createSignedUrl(`${path}/${data[0].name}`, 3600)
      templates.push({ type, filename: data[0].name, url: signed?.signedUrl || '' })
    }
  }

  return NextResponse.json({ templates })
}

export async function POST(req: NextRequest) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const templateType = formData.get('type') as string | null

  if (!file || !templateType || !TEMPLATE_TYPES.includes(templateType as typeof TEMPLATE_TYPES[number])) {
    return NextResponse.json({ error: 'file and type (rfp_sub|sow_sub|customer_sow) required' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext !== 'docx') {
    return NextResponse.json({ error: 'Only .docx templates are supported' }, { status: 400 })
  }

  const admin = createAdminClient()
  const storagePath = `sow-templates/${user.org_id}/${templateType}/${file.name}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error } = await admin.storage.from('org-assets').upload(storagePath, buffer, {
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    upsert: true,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ uploaded: true, path: storagePath }, { status: 201 })
}
