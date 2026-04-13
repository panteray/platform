import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID ?? ''
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? ''
const REDIRECT_URI = process.env.CALENDAR_OAUTH_REDIRECT_URI ?? ''

/**
 * GET /api/integrations/google-calendar
 * Returns OAuth authorization URL for Google Calendar.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!GOOGLE_CLIENT_ID || !REDIRECT_URI) {
    return NextResponse.json({ error: 'Google Calendar integration not configured' }, { status: 503 })
  }

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: `${REDIRECT_URI}/api/integrations/google-calendar/callback`,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar',
    access_type: 'offline',
    prompt: 'consent',
    state: user.id,
  })

  return NextResponse.json({
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  })
}

/**
 * DELETE /api/integrations/google-calendar
 * Disconnects Google Calendar by removing the user credential.
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
    .eq('provider', 'google_calendar')

  return NextResponse.json({ ok: true })
}

/**
 * POST /api/integrations/google-calendar
 * Exchange authorization code for tokens and store in user_credentials.
 * Called by the callback page after OAuth redirect.
 * Body: { code: string }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !REDIRECT_URI) {
    return NextResponse.json({ error: 'Google Calendar integration not configured' }, { status: 503 })
  }

  const { code } = await req.json()
  if (!code) return NextResponse.json({ error: 'code is required' }, { status: 400 })

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: `${REDIRECT_URI}/api/integrations/google-calendar/callback`,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    const err = await tokenRes.text()
    console.error('[google-calendar] Token exchange failed:', err)
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

  // Upsert credential
  await admin
    .from('user_credentials')
    .upsert(
      {
        user_id: dbUser.id,
        org_id: dbUser.org_id,
        provider: 'google_calendar',
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
