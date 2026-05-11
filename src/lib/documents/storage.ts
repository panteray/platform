import { createAdminClient } from '@/lib/supabase/admin'

export const PROJECT_DOCS_BUCKET = 'project-documents'

interface UploadArgs {
  orgId: string
  projectId: string
  filename: string
  buffer: Buffer
  mimeType: string
}

export interface UploadResult {
  storagePath: string
  byteSize: number
}

export async function uploadProjectDocument(args: UploadArgs): Promise<UploadResult> {
  const admin = createAdminClient()
  const storagePath = `${args.orgId}/${args.projectId}/${args.filename}`
  const { error } = await admin.storage.from(PROJECT_DOCS_BUCKET).upload(storagePath, args.buffer, {
    contentType: args.mimeType,
    upsert: true,
  })
  if (error) throw new Error(`Storage upload failed: ${error.message}`)
  return { storagePath, byteSize: args.buffer.byteLength }
}

export async function signProjectDocumentUrl(storagePath: string, expiresInSeconds = 3600): Promise<string> {
  const admin = createAdminClient()
  const { data, error } = await admin.storage.from(PROJECT_DOCS_BUCKET).createSignedUrl(storagePath, expiresInSeconds)
  if (error || !data?.signedUrl) throw new Error(`Signed URL failed: ${error?.message ?? 'unknown'}`)
  return data.signedUrl
}
