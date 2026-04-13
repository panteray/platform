/**
 * Network Wiring Simulator + Checker
 *
 * Runs physical (L1) and logical (L2/L3) checks against the network design.
 * Produces a results report exportable to PDF via the vault.
 */

export interface CheckResult {
  id: string
  layer: 'L1' | 'L2' | 'L3'
  severity: 'error' | 'warning' | 'info'
  check: string
  message: string
  deviceId?: string
  deviceLabel?: string
}

export interface NetworkCheckerInput {
  devices: Array<{
    id: string; label: string; category: string
    properties: Record<string, unknown>
    position_x: number; position_y: number
  }>
  cables: Array<{
    id: string; cable_type: string; length_ft: number
    from_device_id: string | null; to_device_id: string | null
    mdf_idf_id: string | null
  }>
  mdfIdfs: Array<{ id: string; name: string }>
  topologyNodes: Array<{ id: string; node_type: string; label: string; properties: Record<string, unknown> }>
  topologyLinks: Array<{ id: string; from_node_id: string; to_node_id: string; link_type: string; properties: Record<string, unknown> }>
  vlans: Array<{ id: string; vlan_id: number; name: string; subnet: string; gateway: string }>
}

export interface NetworkCheckerOutput {
  results: CheckResult[]
  summary: { errors: number; warnings: number; info: number; total: number }
  timestamp: string
}

// ---- Cable max lengths by type ----
const CABLE_MAX_FT: Record<string, number> = {
  cat6: 328, cat6a: 328, cat5e: 328, // 100m copper
  fiber_om3: 984, fiber_om4: 1312, fiber_sm: 32808, // multimode/singlemode
  '18_2': 500, '22_4': 500, '22_6': 500, '14_2': 500,
  speaker: 200, coax: 500,
}

// ---- Main Checker ----

export function runNetworkChecker(input: NetworkCheckerInput): NetworkCheckerOutput {
  const results: CheckResult[] = []
  let nextId = 1
  const addResult = (layer: CheckResult['layer'], severity: CheckResult['severity'], check: string, message: string, deviceId?: string, deviceLabel?: string) => {
    results.push({ id: `CHK-${String(nextId++).padStart(3, '0')}`, layer, severity, check, message, deviceId, deviceLabel })
  }

  // ═══ L1 — Physical Checks ═══

  // Cable distance limits
  for (const cable of input.cables) {
    const maxFt = CABLE_MAX_FT[cable.cable_type] || 328
    if (cable.length_ft > maxFt) {
      addResult('L1', 'error', 'Cable Distance', `Cable run exceeds ${maxFt}ft max for ${cable.cable_type}: ${cable.length_ft}ft`, cable.from_device_id || undefined)
    } else if (cable.length_ft > maxFt * 0.9) {
      addResult('L1', 'warning', 'Cable Distance', `Cable run at ${Math.round(cable.length_ft / maxFt * 100)}% of max (${cable.length_ft}ft / ${maxFt}ft)`, cable.from_device_id || undefined)
    }
  }

  // Orphaned devices (no cable connection)
  const cableDeviceIds = new Set<string>()
  for (const c of input.cables) {
    if (c.from_device_id) cableDeviceIds.add(c.from_device_id)
    if (c.to_device_id) cableDeviceIds.add(c.to_device_id)
  }
  const CAMERA_CATS = ['cctv', 'dome', 'bullet', 'turret', 'ptz', 'fisheye', 'multisensor_quad', 'multisensor_dual']
  for (const d of input.devices) {
    if (CAMERA_CATS.includes(d.category) && !cableDeviceIds.has(d.id)) {
      addResult('L1', 'warning', 'Orphaned Device', `${d.label || 'Camera'} has no cable connection`, d.id, d.label)
    }
  }

  // Duplicate device labels
  const labelCounts = new Map<string, number>()
  for (const d of input.devices) {
    if (d.label) labelCounts.set(d.label, (labelCounts.get(d.label) || 0) + 1)
  }
  for (const [label, count] of labelCounts) {
    if (count > 1) addResult('L1', 'warning', 'Duplicate Label', `Label "${label}" is used by ${count} devices`)
  }

  // PoE budget check per MDF
  for (const mdf of input.mdfIdfs) {
    const mdfCables = input.cables.filter(c => c.mdf_idf_id === mdf.id)
    const connectedDevices = mdfCables.map(c => input.devices.find(d => d.id === c.from_device_id || d.id === c.to_device_id)).filter(Boolean)
    let totalWatts = 0
    for (const d of connectedDevices) {
      if (!d) continue
      const watts = Number(d.properties?.poe_watts) || 15
      totalWatts += watts
    }
    if (totalWatts > 370) {
      addResult('L1', 'error', 'PoE Budget', `${mdf.name}: PoE draw ${totalWatts}W exceeds typical 370W switch budget`, undefined, mdf.name)
    } else if (totalWatts > 300) {
      addResult('L1', 'warning', 'PoE Budget', `${mdf.name}: PoE draw ${totalWatts}W approaching switch budget limit`, undefined, mdf.name)
    }
  }

  // Port count check
  for (const mdf of input.mdfIdfs) {
    const portCount = input.cables.filter(c => c.mdf_idf_id === mdf.id).length
    if (portCount > 48) {
      addResult('L1', 'error', 'Port Count', `${mdf.name}: ${portCount} ports exceeds single switch capacity (48)`, undefined, mdf.name)
    } else if (portCount > 24) {
      addResult('L1', 'info', 'Port Count', `${mdf.name}: ${portCount} ports — may need 48-port switch or stacking`, undefined, mdf.name)
    }
  }

  // ═══ L2 — Switching Checks ═══

  // Duplicate VLAN IDs
  const vlanIds = new Map<number, string[]>()
  for (const v of input.vlans) {
    const list = vlanIds.get(v.vlan_id) || []
    list.push(v.name)
    vlanIds.set(v.vlan_id, list)
  }
  for (const [vid, names] of vlanIds) {
    if (names.length > 1) addResult('L2', 'error', 'Duplicate VLAN', `VLAN ${vid} assigned to multiple entries: ${names.join(', ')}`)
  }

  // VLAN conflicts (overlapping subnets)
  for (let i = 0; i < input.vlans.length; i++) {
    for (let j = i + 1; j < input.vlans.length; j++) {
      const a = input.vlans[i], b = input.vlans[j]
      if (a.subnet && b.subnet && a.subnet === b.subnet && a.vlan_id !== b.vlan_id) {
        addResult('L2', 'error', 'Subnet Overlap', `VLANs ${a.vlan_id} (${a.name}) and ${b.vlan_id} (${b.name}) share subnet ${a.subnet}`)
      }
    }
  }

  // ═══ L3 — Routing Checks ═══

  // Missing gateways
  for (const v of input.vlans) {
    if (v.subnet && !v.gateway) {
      addResult('L3', 'warning', 'Missing Gateway', `VLAN ${v.vlan_id} (${v.name}) has subnet ${v.subnet} but no gateway configured`)
    }
  }

  // Duplicate IP addresses across devices
  const ipMap = new Map<string, string[]>()
  for (const d of input.devices) {
    const ip = d.properties?.ip_address as string
    if (ip) {
      const list = ipMap.get(ip) || []
      list.push(d.label || d.id)
      ipMap.set(ip, list)
    }
  }
  for (const [ip, labels] of ipMap) {
    if (labels.length > 1) addResult('L3', 'error', 'Duplicate IP', `IP ${ip} assigned to ${labels.length} devices: ${labels.join(', ')}`)
  }

  // Topology node checks
  const nodeIds = new Set(input.topologyNodes.map(n => n.id))
  for (const link of input.topologyLinks) {
    if (!nodeIds.has(link.from_node_id)) addResult('L1', 'error', 'Broken Link', `Topology link references missing from-node ${link.from_node_id}`)
    if (!nodeIds.has(link.to_node_id)) addResult('L1', 'error', 'Broken Link', `Topology link references missing to-node ${link.to_node_id}`)
  }

  const errors = results.filter(r => r.severity === 'error').length
  const warnings = results.filter(r => r.severity === 'warning').length
  const info = results.filter(r => r.severity === 'info').length

  return {
    results,
    summary: { errors, warnings, info, total: results.length },
    timestamp: new Date().toISOString(),
  }
}
