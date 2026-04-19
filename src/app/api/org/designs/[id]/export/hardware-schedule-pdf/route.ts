import { NextRequest, NextResponse } from 'next/server'
import { verifyDesignAccess } from '@/lib/auth'
import { signPrintToken } from '@/lib/pdf/print-token'
import { launchBrowser } from '@/lib/pdf/chromium'

export const runtime = 'nodejs'
export const maxDuration = 120

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_').substring(0, 60) || 'Hardware_Schedule'
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: designId } = await params
  const token = signPrintToken({ designId, orgId: user.org_id! })

  const origin = req.nextUrl.origin
  const printUrl = `${origin}/internal/print/hardware-schedule/${designId}?token=${encodeURIComponent(token)}`

  let browser
  try {
    browser = await launchBrowser()
    const page = await browser.newPage()
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 })
    await page.goto(printUrl, { waitUntil: 'networkidle0', timeout: 60_000 })
    await page.waitForFunction('window.__printReady === true', { timeout: 45_000 })
    const pdf = await page.pdf({
      format: 'letter',
      printBackground: true,
      margin: { top: '0.5in', bottom: '0.5in', left: '0.5in', right: '0.5in' },
    })
    await browser.close()

    return new NextResponse(pdf as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${sanitizeFilename(designId)}_Hardware_Schedule.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    try { await browser?.close() } catch { /* ignore */ }
    console.error('Hardware Schedule PDF generation failed:', err)
    return NextResponse.json({ error: 'PDF generation failed', detail: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
