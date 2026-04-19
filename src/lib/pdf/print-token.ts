import crypto from 'crypto'

const TTL_MS = 5 * 60 * 1000

function secret(): string {
  const s = process.env.PRINT_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!s) throw new Error('PRINT_TOKEN_SECRET not configured')
  return s
}

export function signPrintToken(payload: { designId: string; orgId: string }): string {
  const body = { ...payload, exp: Date.now() + TTL_MS }
  const json = Buffer.from(JSON.stringify(body)).toString('base64url')
  const sig = crypto.createHmac('sha256', secret()).update(json).digest('base64url')
  return `${json}.${sig}`
}

export function verifyPrintToken(token: string): { designId: string; orgId: string } | null {
  const [json, sig] = token.split('.')
  if (!json || !sig) return null
  const expected = crypto.createHmac('sha256', secret()).update(json).digest('base64url')
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  try {
    const body = JSON.parse(Buffer.from(json, 'base64url').toString('utf8')) as {
      designId: string; orgId: string; exp: number
    }
    if (body.exp < Date.now()) return null
    return { designId: body.designId, orgId: body.orgId }
  } catch {
    return null
  }
}
