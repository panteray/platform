import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/integrations/google-calendar/callback
 * OAuth redirect handler. Receives the authorization code from Google,
 * then redirects to the frontend page which will POST the code to complete the exchange.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const error = req.nextUrl.searchParams.get('error')

  if (error) {
    return NextResponse.redirect(
      new URL(`/org/settings?calendar_error=${encodeURIComponent(error)}`, req.url)
    )
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/org/settings?calendar_error=no_code', req.url)
    )
  }

  // Redirect to settings page with code param — the page will POST it to complete exchange
  return NextResponse.redirect(
    new URL(`/org/settings?google_calendar_code=${encodeURIComponent(code)}`, req.url)
  )
}
