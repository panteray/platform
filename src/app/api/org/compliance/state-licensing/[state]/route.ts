import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ state: string }> }) {
  const { state } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('state_licensing_reference')
    .select('*')
    .eq('state', state.toUpperCase())

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'State not found' }, { status: 404 })
  return NextResponse.json(data)
}
