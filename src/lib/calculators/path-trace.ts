/**
 * Path Trace — finds the shortest hop-by-hop route between two nodes
 * in the topology graph using BFS.
 */

export interface PathTraceResult {
  found: boolean
  path: string[] // node IDs in order
  hops: number
  links: string[] // link IDs traversed
}

export function tracePathBFS(
  fromNodeId: string,
  toNodeId: string,
  links: Array<{ id: string; from_node_id: string; to_node_id: string }>,
): PathTraceResult {
  if (fromNodeId === toNodeId) return { found: true, path: [fromNodeId], hops: 0, links: [] }

  // Build adjacency list
  const adj = new Map<string, Array<{ nodeId: string; linkId: string }>>()
  for (const link of links) {
    const fromList = adj.get(link.from_node_id) || []
    fromList.push({ nodeId: link.to_node_id, linkId: link.id })
    adj.set(link.from_node_id, fromList)

    const toList = adj.get(link.to_node_id) || []
    toList.push({ nodeId: link.from_node_id, linkId: link.id })
    adj.set(link.to_node_id, toList)
  }

  // BFS
  const visited = new Set<string>([fromNodeId])
  const queue: Array<{ nodeId: string; path: string[]; linkPath: string[] }> = [
    { nodeId: fromNodeId, path: [fromNodeId], linkPath: [] },
  ]

  while (queue.length > 0) {
    const current = queue.shift()!
    const neighbors = adj.get(current.nodeId) || []

    for (const { nodeId, linkId } of neighbors) {
      if (visited.has(nodeId)) continue
      visited.add(nodeId)

      const newPath = [...current.path, nodeId]
      const newLinkPath = [...current.linkPath, linkId]

      if (nodeId === toNodeId) {
        return { found: true, path: newPath, hops: newPath.length - 1, links: newLinkPath }
      }

      queue.push({ nodeId, path: newPath, linkPath: newLinkPath })
    }
  }

  return { found: false, path: [], hops: 0, links: [] }
}
