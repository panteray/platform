import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const OUTLOOK_CLIENT_ID = process.env.OUTLOOK_CLIENT_ID ?? ''
const OUTLOOK_CLIENT_SECRET = process.env.OUTLOOK_CLIENT_SECRET ?? ''
const REDIRECT_URI = process.env.CALENDAR_OAUTH_REDIRECT_URI ?? ''

/**
 * GET /api/integrations/outlook-calendar
 * Returns OAuth authorization URL for Microsoft Outlook Calendar.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!OUTLOOK_CLIENT_ID || !REDIRECT_URI) {
    return NextResponse.json({ error: 'Outlook Calendar integration not configured' }, { status: 503 })
  }

  const params = new URLSearchParams({
    client_id: OUTLOOK_CLIENT_ID,
    redirect_uri: `${REDIRECT_URI}/api/integrations/outlook-calendar/callback`,
    response_type: 'code',
    scope: 'https://graph.microsoft.com/Calendars.ReadWrite offline_access',
    response_mode: 'query',
    state: user.id,
  })

  return NextResponse.json({
    url: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`,
  })
}

/**
 * DELETE /api/integrations/outlook-calendar
 * Disconnects Outlook Calendar by removing the user credential.
 */
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: dbUser } = await admin
    .from('users')
    .select('id, org_id')
    .eq('auth_id', user.id)
    .single()
  if (!dbUser?.org_id) return NextResponse.json({ error: 'No org' }, { status: 403 })

  await admin
    .from('user_credentials')
    .delete()
    .eq('user_id', dbUser.id)
    .eq('provider', 'outlook_calendar')

  return NextResponse.json({ ok: true })
}

/**
 * POST /api/integrations/outlook-calendar
 * Exchange authorization code for tokens and store in user_credentials.
 * Body: { code: string }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!OUTLOOK_CLIENT_ID || !OUTLOOK_CLIENT_SECRET || !REDIRECT_URI) {
    return NextResponse.json({ error: 'Outlook Calendar integration not configured' }, { status: 503 })
  }

  const { code } = await req.json()
  if (!code) return NextResponse.json({ error: 'code is required' }, { status: 400 })

  const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: OUTLOOK_CLIENT_ID,
      client_secret: OUTLOOK_CLIENT_SECRET,
      redirect_uri: `${REDIRECT_URI}/api/integrations/outlook-calendar/callback`,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    const err = await tokenRes.text()
    console.error('[outlook-calendar] Token exchange failed:', err)
    return NextResponse.json({ error: 'Token exchange failed' }, { status: 502 })
  }

  const tokens = await tokenRes.json()

  const admin = createAdminClient()
  const { data: dbUser } = await admin
    .from('users')
    .select('id, org_id')
    .eq('auth_id', user.id)
    .single()
  if (!dbUser?.org_id) return NextResponse.json({ error: 'No org' }, { status: 403 })

  await admin
    .from('user_credentials')
    .upsert(
      {
        user_id: dbUser.id,
        org_id: dbUser.org_id,
        provider: 'outlook_calendar',
        access_token_enc: tokens.access_token,
        refresh_token_enc: tokens.refresh_token ?? null,
        token_expires_at: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
          : null,
        scope: tokens.scope ?? null,
      },
      { onConflict: 'user_id,provider' }
    )

  return NextResponse.json({ ok: true })
}
