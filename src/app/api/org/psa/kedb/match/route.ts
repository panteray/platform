import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Lightweight KEDB match: scores entries by token overlap against a title+description.
 * Returns top 3 matches above score threshold.
 */
export async function POST(req: NextRequest) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { title?: string; description?: string; category?: string; ticket_id?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const haystack = `${body.title ?? ''} ${body.description ?? ''}`.toLowerCase()
  if (haystack.trim().length < 3) return NextResponse.json([])

  const tokens = Array.from(new Set(
    haystack.split(/[^a-z0-9]+/).filter(t => t.length >= 4)
  ))

  const admin = createAdminClient()
  let query = admin
    .from('psa_kedb_entries')
    .select('id, kedb_number, title, symptoms, workaround, category, match_count, last_matched_at')
    .eq('org_id', dbUser.org_id)
    .is('archived_at', null)

  if (body.category) query = query.eq('category', body.category)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type KedbRow = {
    id: string
    kedb_number: string
    title: string
    symptoms: string
    workaround: string | null
    category: string | null
    match_count: number
    last_matched_at: string | null
  }

  const scored = (data as KedbRow[] | null ?? [])
    .map(entry => {
      const text = `${entry.title} ${entry.symptoms}`.toLowerCase()
      const hits = tokens.filter(t => text.includes(t)).length
      const score = tokens.length > 0 ? hits / tokens.length : 0
      return { entry, score }
    })
    .filter(m => m.score >= 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  // Bump match_count on returned entries (fire-and-forget)
  if (scored.length > 0) {
    const ids = scored.map(m => m.entry.id)
    admin
      .from('psa_kedb_entries')
      .update({ last_matched_at: new Date().toISOString() })
      .in('id', ids)
      .eq('org_id', dbUser.org_id)
      .then(() => {})
  }

  return NextResponse.json(scored.map(m => ({ ...m.entry, score: m.score })))
}
