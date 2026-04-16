// NOTE: access_token_enc / refresh_token_enc column names are misleading —
// tokens are stored as plaintext. Encryption at rest is handled by Supabase.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/integrations/calendar-sync
 * Syncs lead_meetings for the current user to their connected calendar (Google or Outlook).
 * Pushes unsynced meetings as calendar events.
 */
export async function POST() {
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

  // Get user credentials
  const { data: credentials } = await admin
    .from('user_credentials')
    .select('*')
    .eq('user_id', dbUser.id)
    .in('provider', ['google_calendar', 'outlook_calendar'])

  if (!credentials || credentials.length === 0) {
    return NextResponse.json({ error: 'No calendar connected' }, { status: 400 })
  }

  // Get unsynced meetings created by this user
  const { data: meetings } = await admin
    .from('lead_meetings')
    .select('*')
    .eq('org_id', dbUser.org_id)
    .eq('created_by', dbUser.id)
    .is('calendar_event_id', null)
    .order('start_time', { ascending: true })

  if (!meetings || meetings.length === 0) {
    return NextResponse.json({ synced: 0, message: 'No meetings to sync' })
  }

  let synced = 0
  const errors: string[] = []

  for (const cred of credentials) {
    // Refresh token if expired
    const accessToken = await getValidToken(cred, admin)
    if (!accessToken) {
      errors.push(`${cred.provider}: token refresh failed`)
      continue
    }

    for (const meeting of meetings) {
      try {
        let eventId: string | null = null

        if (cred.provider === 'google_calendar') {
          eventId = await createGoogleEvent(accessToken, meeting)
        } else if (cred.provider === 'outlook_calendar') {
          eventId = await createOutlookEvent(accessToken, meeting)
        }

        if (eventId) {
          await admin
            .from('lead_meetings')
            .update({
              calendar_event_id: eventId,
              calendar_provider: cred.provider === 'google_calendar' ? 'google' : 'outlook',
              sync_status: 'synced',
            })
            .eq('id', meeting.id)
          synced++
        }
      } catch (err) {
        console.error(`[calendar-sync] Failed to sync meeting ${meeting.id}:`, err)
        errors.push(`Meeting ${meeting.id}: sync failed`)
      }
    }
  }

  return NextResponse.json({ synced, errors: errors.length > 0 ? errors : undefined })
}

/**
 * GET /api/integrations/calendar-sync
 * Returns the user's connected calendar status.
 */
export async function GET() {
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

  const { data: credentials } = await admin
    .from('user_credentials')
    .select('provider, scope, token_expires_at, created_at, updated_at')
    .eq('user_id', dbUser.id)
    .in('provider', ['google_calendar', 'outlook_calendar'])

  return NextResponse.json({
    google: credentials?.find((c) => c.provider === 'google_calendar') ?? null,
    outlook: credentials?.find((c) => c.provider === 'outlook_calendar') ?? null,
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Credential {
  id: string
  provider: string
  access_token_enc: string
  refresh_token_enc: string | null
  token_expires_at: string | null
  user_id: string
  org_id: string
}

interface Meeting {
  id: string
  title: string
  description: string | null
  location: string | null
  start_time: string
  end_time: string
}

async function getValidToken(
  cred: Credential,
  admin: ReturnType<typeof createAdminClient>
): Promise<string | null> {
  // Check if token is still valid (with 5 min buffer)
  if (cred.token_expires_at) {
    const expires = new Date(cred.token_expires_at)
    if (expires.getTime() > Date.now() + 300_000) {
      return cred.access_token_enc
    }
  }

  // Token expired — attempt refresh
  if (!cred.refresh_token_enc) return null

  try {
    let tokens: { access_token: string; expires_in?: number } | null = null

    if (cred.provider === 'google_calendar') {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID ?? '',
          client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? '',
          refresh_token: cred.refresh_token_enc,
          grant_type: 'refresh_token',
        }),
      })
      if (res.ok) tokens = await res.json()
    } else if (cred.provider === 'outlook_calendar') {
      const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.OUTLOOK_CLIENT_ID ?? '',
          client_secret: process.env.OUTLOOK_CLIENT_SECRET ?? '',
          refresh_token: cred.refresh_token_enc,
          grant_type: 'refresh_token',
        }),
      })
      if (res.ok) tokens = await res.json()
    }

    if (tokens?.access_token) {
      await admin
        .from('user_credentials')
        .update({
          access_token_enc: tokens.access_token,
          token_expires_at: tokens.expires_in
            ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
            : null,
        })
        .eq('id', cred.id)

      return tokens.access_token
    }
  } catch (err) {
    console.error(`[calendar-sync] Token refresh failed for ${cred.provider}:`, err)
  }

  return null
}

async function createGoogleEvent(token: string, meeting: Meeting): Promise<string | null> {
  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary: meeting.title,
      description: meeting.description ?? undefined,
      location: meeting.location ?? undefined,
      start: { dateTime: meeting.start_time, timeZone: 'America/Chicago' },
      end: { dateTime: meeting.end_time, timeZone: 'America/Chicago' },
    }),
  })

  if (!res.ok) {
    console.error('[calendar-sync] Google event creation failed:', await res.text())
    return null
  }

  const event = await res.json()
  return event.id ?? null
}

async function createOutlookEvent(token: string, meeting: Meeting): Promise<string | null> {
  const res = await fetch('https://graph.microsoft.com/v1.0/me/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subject: meeting.title,
      body: meeting.description
        ? { contentType: 'text', content: meeting.description }
        : undefined,
      location: meeting.location ? { displayName: meeting.location } : undefined,
      start: { dateTime: meeting.start_time, timeZone: 'Central Standard Time' },
      end: { dateTime: meeting.end_time, timeZone: 'Central Standard Time' },
    }),
  })

  if (!res.ok) {
    console.error('[calendar-sync] Outlook event creation failed:', await res.text())
    return null
  }

  const event = await res.json()
  return event.id ?? null
}
