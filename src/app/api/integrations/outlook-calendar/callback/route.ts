import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/integrations/outlook-calendar/callback
 * OAuth redirect handler for Microsoft. Redirects to frontend with code.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const error = req.nextUrl.searchParams.get('error')

  if (error) {
    const description = req.nextUrl.searchParams.get('error_description') ?? error
    return NextResponse.redirect(
      new URL(`/org/settings?calendar_error=${encodeURIComponent(description)}`, req.url)
    )
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/org/settings?calendar_error=no_code', req.url)
    )
  }

  return NextResponse.redirect(
    new URL(`/org/settings?outlook_calendar_code=${encodeURIComponent(code)}`, req.url)
  )
}
