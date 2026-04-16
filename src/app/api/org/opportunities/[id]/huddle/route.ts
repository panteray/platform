import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: oppId } = await params
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  // Find thread for this OPP
  const { data: thread } = await admin
    .from('opp_huddle_threads')
    .select('id')
    .eq('opp_id', oppId)
    .eq('org_id', caller.org_id)
    .single()

  if (!thread) return NextResponse.json([])

  // Load messages with author join
  const { data, error } = await admin
    .from('opp_huddle_messages')
    .select('*, author:users!opp_huddle_messages_author_id_fkey(id, first_name, last_name, email, role)')
    .eq('thread_id', thread.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data ?? [])
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: oppId } = await params
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const message = (body.message as string)?.trim()
  if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 })

  const admin = createAdminClient()

  // Get or create thread
  let { data: thread } = await admin
    .from('opp_huddle_threads')
    .select('id')
    .eq('opp_id', oppId)
    .eq('org_id', caller.org_id)
    .single()

  if (!thread) {
    const { data: newThread, error: threadErr } = await admin
      .from('opp_huddle_threads')
      .insert({ org_id: caller.org_id, opp_id: oppId })
      .select('id')
      .single()
    if (threadErr) return NextResponse.json({ error: threadErr.message }, { status: 400 })
    thread = newThread
  }

  // Insert message
  const { data: msg, error } = await admin
    .from('opp_huddle_messages')
    .insert({
      org_id: caller.org_id,
      thread_id: thread!.id,
      author_id: caller.id,
      message,
    })
    .select('*, author:users!opp_huddle_messages_author_id_fkey(id, first_name, last_name, email, role)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Write mentions
  const mentions = body.mentions as string[] | undefined
  if (mentions && mentions.length > 0) {
    const mentionRows = mentions.map((userId: string) => ({
      org_id: caller.org_id,
      mentioned_user_id: userId,
      opp_message_id: msg.id,
    }))
    await admin.from('huddle_mentions').insert(mentionRows)
  }

  return NextResponse.json(msg, { status: 201 })
}
