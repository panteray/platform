import { createAdminClient } from './admin'

const VAULT = 'vault-docs'
const ONE_HOUR_SECONDS = 3600

function sanitizeFilename(filename: string): string {
  const normalized = filename.trim()
  if (!normalized) return 'file'
  return normalized.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export async function uploadVaultFile(
  fileBytes: ArrayBuffer,
  orgId: string,
  vaultId: string,
  filename: string,
  contentType: string,
): Promise<{ storagePath: string }> {
  const admin = createAdminClient()
  const safeName = sanitizeFilename(filename)
  const storagePath = `${orgId}/${vaultId}/${Date.now()}-${safeName}`

  const { error } = await admin.storage
    .from(VAULT)
    .upload(storagePath, fileBytes, { contentType, upsert: false })

  if (error) throw new Error(`Storage upload failed: ${error.message}`)
  return { storagePath }
}

export async function getSignedDownloadUrl(storagePath: string): Promise<string> {
  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from(VAULT)
    .createSignedUrl(storagePath, ONE_HOUR_SECONDS)

  if (error || !data?.signedUrl) {
    throw new Error(`Signed URL failed: ${error?.message ?? 'unknown'}`)
  }
  return data.signedUrl
}
