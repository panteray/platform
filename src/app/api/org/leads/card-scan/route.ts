import { NextRequest, NextResponse } from 'next/server'
import { verifyLeadCrud } from '@/lib/auth'

/**
 * POST /api/org/leads/card-scan
 * Receives a base64-encoded business card image, sends to Google Cloud Vision OCR,
 * returns structured contact fields.
 *
 * Body: { image: string (base64 data URL or raw base64) }
 * Returns: { raw: string, parsed: { first_name, last_name, title, company, email, phone, mobile, address, city, state, zip, website } }
 */
export async function POST(req: NextRequest) {
  const dbUser = await verifyLeadCrud()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const visionKey = process.env.GOOGLE_CLOUD_VISION_KEY
  if (!visionKey) {
    return NextResponse.json(
      { error: 'GOOGLE_CLOUD_VISION_KEY not configured' },
      { status: 503 }
    )
  }

  const body = await req.json()
  const imageData: string = body.image

  if (!imageData) {
    return NextResponse.json({ error: 'image is required' }, { status: 400 })
  }

  // Strip data URL prefix if present
  const base64 = imageData.replace(/^data:image\/\w+;base64,/, '')

  try {
    // Call Google Cloud Vision TEXT_DETECTION
    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${visionKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64 },
              features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
            },
          ],
        }),
      }
    )

    if (!visionRes.ok) {
      const errText = await visionRes.text()
      console.error('[card-scan] Vision API error:', visionRes.status, errText)
      return NextResponse.json(
        { error: 'Vision API error', detail: errText },
        { status: 502 }
      )
    }

    const visionData = await visionRes.json()
    const annotations = visionData.responses?.[0]?.textAnnotations
    const rawText: string = annotations?.[0]?.description ?? ''

    if (!rawText.trim()) {
      return NextResponse.json(
        { raw: '', parsed: {}, message: 'No text detected on card' },
        { status: 200 }
      )
    }

    // Parse structured fields from raw OCR text
    const parsed = parseBusinessCard(rawText)

    return NextResponse.json({ raw: rawText, parsed })
  } catch (err) {
    console.error('[card-scan] Error:', err)
    return NextResponse.json(
      { error: 'OCR processing failed' },
      { status: 500 }
    )
  }
}

/**
 * Best-effort parsing of raw OCR text into structured contact fields.
 * Falls back gracefully — user will review and correct.
 */
function parseBusinessCard(raw: string): Record<string, string | null> {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)

  const result: Record<string, string | null> = {
    first_name: null,
    last_name: null,
    title: null,
    company: null,
    email: null,
    phone: null,
    mobile: null,
    address: null,
    city: null,
    state: null,
    zip: null,
    website: null,
  }

  // Email
  const emailLine = lines.find((l) => /[\w.-]+@[\w.-]+\.\w{2,}/.test(l))
  if (emailLine) {
    const match = emailLine.match(/([\w.-]+@[\w.-]+\.\w{2,})/)
    if (match) result.email = match[1].toLowerCase()
  }

  // Phone — look for patterns like (xxx) xxx-xxxx or xxx-xxx-xxxx or xxx.xxx.xxxx
  const phonePatterns = lines.filter((l) =>
    /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(l)
  )
  if (phonePatterns.length >= 1) {
    const firstPhone = phonePatterns[0].match(
      /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/
    )
    if (firstPhone) result.phone = firstPhone[0]
  }
  if (phonePatterns.length >= 2) {
    const secondPhone = phonePatterns[1].match(
      /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/
    )
    if (secondPhone) result.mobile = secondPhone[0]
  }

  // Website
  const webLine = lines.find((l) =>
    /(?:www\.|https?:\/\/|\.com|\.net|\.org|\.io)/.test(l.toLowerCase()) &&
    !l.includes('@')
  )
  if (webLine) {
    const match = webLine.match(/((?:https?:\/\/)?(?:www\.)?[\w.-]+\.\w{2,}(?:\/\S*)?)/)
    if (match) result.website = match[1]
  }

  // State + ZIP — look for 2-letter state code + 5-digit zip
  const stateZipLine = lines.find((l) =>
    /\b[A-Z]{2}\b\s*\d{5}/.test(l)
  )
  if (stateZipLine) {
    const match = stateZipLine.match(/\b([A-Z]{2})\b\s*(\d{5})/)
    if (match) {
      result.state = match[1]
      result.zip = match[2]
    }
    // City is usually before state
    const cityMatch = stateZipLine.match(/^([^,]+),?\s*[A-Z]{2}/)
    if (cityMatch) result.city = cityMatch[1].trim()
  }

  // Address — line with street number
  const addressLine = lines.find(
    (l) => /^\d+\s+\w/.test(l) && !phonePatterns.includes(l)
  )
  if (addressLine) {
    // If this line also contains city/state, extract just the street
    if (result.city && addressLine.includes(result.city)) {
      result.address = addressLine.split(result.city)[0].replace(/,\s*$/, '').trim()
    } else {
      result.address = addressLine
    }
  }

  // Name — heuristic: first line that isn't phone/email/address/web and looks like a name
  const usedLines = new Set([emailLine, webLine, stateZipLine, addressLine, ...phonePatterns])
  const nameCandidate = lines.find(
    (l) =>
      !usedLines.has(l) &&
      l.length < 40 &&
      /^[A-Za-z]/.test(l) &&
      !/[@.\/\\]/.test(l) &&
      !/^\d/.test(l) &&
      !/(?:inc|llc|corp|ltd|street|ave|blvd|suite|ste)/i.test(l)
  )
  if (nameCandidate) {
    const parts = nameCandidate.split(/\s+/)
    if (parts.length >= 2) {
      result.first_name = parts[0]
      result.last_name = parts.slice(1).join(' ')
    } else {
      result.first_name = parts[0]
    }
  }

  // Title — next non-used line after name that looks like a title
  const titleKeywords = /manager|director|vp|president|engineer|technician|specialist|coordinator|admin|sales|rep|consultant|officer|chief|head|lead|supervisor|analyst|designer|architect|ceo|cfo|cto|coo/i
  const titleCandidate = lines.find(
    (l) =>
      !usedLines.has(l) &&
      l !== nameCandidate &&
      (titleKeywords.test(l) || (l.length < 50 && /^[A-Z]/.test(l) && !l.includes('@')))
  )
  if (titleCandidate && titleKeywords.test(titleCandidate)) {
    result.title = titleCandidate
  }

  // Company — look for remaining unused line, often has Inc/LLC or is on the card prominently
  const companyKeywords = /inc|llc|corp|ltd|company|co\.|group|solutions|services|systems|security|technologies|tech|partners|associates/i
  const companyCandidate = lines.find(
    (l) =>
      !usedLines.has(l) &&
      l !== nameCandidate &&
      l !== titleCandidate &&
      companyKeywords.test(l)
  )
  if (companyCandidate) {
    result.company = companyCandidate
  } else {
    // Fallback: second unused line (often company name is line 2)
    const fallback = lines.find(
      (l) =>
        !usedLines.has(l) &&
        l !== nameCandidate &&
        l !== titleCandidate &&
        l.length < 50 &&
        /^[A-Z]/.test(l) &&
        !l.includes('@')
    )
    if (fallback) result.company = fallback
  }

  return result
}
