import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AssetRelationshipType, CiImpactNode, CiImpactResponse } from '@/types/database'

const MAX_DEPTH = 3
const MAX_NODES = 100

/**
 * G6: CI impact traversal for a ticket's linked asset.
 *
 * BFS the `asset_relationships` graph from the ticket's root asset (bounded
 * depth=3, node cap=100). Returns each downstream asset with its depth and the
 * relationship type that pulled it in. Also reports how many OPEN tickets
 * currently touch any node in the impact set — a proxy for blast radius.
 *
 * Returns `{ root_asset_id: null, downstream: [], open_ticket_count: 0 }` when
 * the ticket has no linked asset or no relationships.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: ticket, error: tErr } = await admin
    .from('psa_tickets')
    .select('id, org_id, asset_id')
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .single()

  if (tErr || !ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })

  const empty: CiImpactResponse = { root_asset_id: null, downstream: [], open_ticket_count: 0 }
  if (!ticket.asset_id) return NextResponse.json(empty)

  // BFS — one DB round trip per depth layer
  const downstream: CiImpactNode[] = []
  const visited = new Set<string>([ticket.asset_id])
  let frontier: string[] = [ticket.asset_id]

  for (let depth = 1; depth <= MAX_DEPTH && frontier.length > 0; depth++) {
    if (downstream.length >= MAX_NODES) break

    const { data: edges, error: eErr } = await admin
      .from('asset_relationships')
      .select('parent_asset_id, child_asset_id, relationship_type')
      .eq('org_id', dbUser.org_id)
      .in('parent_asset_id', frontier)

    if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 })
    if (!edges || edges.length === 0) break

    const nextIds = new Set<string>()
    const edgeByChild = new Map<string, AssetRelationshipType>()
    for (const e of edges) {
      if (visited.has(e.child_asset_id)) continue
      visited.add(e.child_asset_id)
      nextIds.add(e.child_asset_id)
      edgeByChild.set(e.child_asset_id, e.relationship_type as AssetRelationshipType)
    }

    if (nextIds.size === 0) break

    // Hydrate asset rows for this layer
    const { data: assetRows } = await admin
      .from('assets')
      .select('id, serial_number, status')
      .eq('org_id', dbUser.org_id)
      .in('id', Array.from(nextIds))

    for (const a of assetRows ?? []) {
      if (downstream.length >= MAX_NODES) break
      const rt = edgeByChild.get(a.id) ?? 'depends_on'
      downstream.push({
        asset_id: a.id,
        serial_number: a.serial_number ?? null,
        status: a.status ?? 'unknown',
        relationship_type: rt,
        depth,
      })
    }

    frontier = Array.from(nextIds)
  }

  // Open ticket count across the impact set (root + downstream)
  const impactIds = [ticket.asset_id, ...downstream.map((d) => d.asset_id)]
  const { count: openCount } = await admin
    .from('psa_tickets')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', dbUser.org_id)
    .in('asset_id', impactIds)
    .not('status', 'in', '("RESOLVED","CANCELLED")')

  const response: CiImpactResponse = {
    root_asset_id: ticket.asset_id,
    downstream,
    open_ticket_count: openCount ?? 0,
  }
  return NextResponse.json(response)
}
