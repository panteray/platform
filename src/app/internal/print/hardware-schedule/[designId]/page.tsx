import { notFound } from 'next/navigation'
import { verifyPrintToken } from '@/lib/pdf/print-token'
import { loadHardwareScheduleData } from '@/lib/pdf/hardware-schedule-data'
import { SITE_REQUIREMENTS } from '@/lib/export-templates/site-requirements'
import { SiteMap } from './site-map'
import { FloorPlanMap } from './floor-plan-map'
import { ReadyMarker } from './ready-marker'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function PrintPage({
  params, searchParams,
}: {
  params: Promise<{ designId: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const { designId } = await params
  const { token } = await searchParams
  if (!token) notFound()
  const claims = verifyPrintToken(token)
  if (!claims || claims.designId !== designId) notFound()

  const data = await loadHardwareScheduleData(designId, claims.orgId)
  if (!data) notFound()

  const { design, opp, vertical, mapsKey, areas, materialsByArea, totals, vaultImages, generatedAt } = data
  const allAreaPhotos = areas.flatMap(a => a.photos.map(p => ({ ...p, areaName: a.name })))
  const appendixPhotos = [
    ...allAreaPhotos,
    ...vaultImages.map(v => ({ ...v, areaName: 'Vault' })),
  ]
  const siteReq = vertical ? SITE_REQUIREMENTS[vertical] : null
  const title = opp?.project_name || design.name
  const oppNum = opp?.opp_number ? `OPP-${opp.opp_number}` : design.name

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <title>{title} — Hardware Schedule</title>
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>
        {/* 1. Cover */}
        <section className="cover">
          <div className="brand">Howard Technology Solutions</div>
          <h1>{title}</h1>
          {opp?.system_name ? <div className="system">{opp.system_name}</div> : null}
          <div className="opp">{oppNum}</div>
          <div className="info">
            {opp?.customer_name ? <div><strong>Customer:</strong> {opp.customer_name}</div> : null}
            {opp?.poc_name ? <div><strong>Contact:</strong> {opp.poc_name}{opp.poc_phone ? ` | ${opp.poc_phone}` : ''}</div> : null}
            {opp?.poc_email ? <div><strong>Email:</strong> {opp.poc_email}</div> : null}
            {opp?.install_address ? <div><strong>Delivery:</strong> {opp.install_address}{opp.state ? `, ${opp.state}` : ''}</div> : null}
          </div>
          <div className="gen">Generated {new Date(generatedAt).toLocaleDateString()}</div>
        </section>

        {/* 2. Project Overview */}
        <section className="page">
          <h2>1. Project Overview</h2>
          <p>
            This Hardware Schedule consolidates the installation scope for{' '}
            {areas.length} location{areas.length !== 1 ? 's' : ''}
            {opp?.project_name ? ` under the ${opp.project_name}` : ''}. All work shall be
            performed in accordance with HTS-approved documentation.
          </p>
          <div className="locations">
            <h3>Project Locations</h3>
            <ul>{areas.map(a => <li key={a.id}><strong>{a.name}</strong></li>)}</ul>
          </div>
        </section>

        {/* 3. Scope Summary */}
        <section className="page">
          <h2>2. Scope Summary</h2>
          <table className="t">
            <thead>
              <tr>
                <th>Location</th>
                <th>New Cameras</th>
                <th>Ext.</th>
                <th>Int.</th>
                <th>Cable (ft)</th>
                <th>Relocations</th>
              </tr>
            </thead>
            <tbody>
              {areas.map(a => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{a.totals.new}</td>
                  <td>{a.totals.ext}</td>
                  <td>{a.totals.int}</td>
                  <td>~{a.totals.cableFt.toLocaleString()}</td>
                  <td>{a.devices.filter(d => d.status === 'relocate').length}</td>
                </tr>
              ))}
              <tr className="tot">
                <td>TOTALS</td>
                <td>{totals.newCameras}</td>
                <td>{totals.exterior}</td>
                <td>{totals.interior}</td>
                <td>~{totals.cableFt.toLocaleString()}</td>
                <td>{totals.relocations}</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* 4. Delivery Schedule */}
        <section className="page">
          <h2>3. Project Delivery Schedule</h2>
          <p>
            Hardware and software shall be delivered to{' '}
            {opp?.install_address ? <>{opp.install_address}{opp.state ? `, ${opp.state}` : ''}</> : 'the site'}.
            Freight is FOB destination. The following is the anticipated delivery and installation schedule:
          </p>
          <table className="t">
            <thead>
              <tr><th>#</th><th>Location</th><th>Task</th><th>Target Date</th><th>Duration</th></tr>
            </thead>
            <tbody>
              <tr><td>1</td><td>All Locations</td><td>Equipment Delivery</td><td>TBD</td><td>—</td></tr>
              {areas.map((a, i) => (
                <tr key={a.id}><td>{i + 2}</td><td>{a.name}</td><td>Installation</td><td>TBD</td><td>TBD</td></tr>
              ))}
              <tr><td>{areas.length + 2}</td><td>All Locations</td><td>Testing &amp; Commissioning</td><td>TBD</td><td>TBD</td></tr>
              <tr><td>{areas.length + 3}</td><td>All Locations</td><td>License Installation</td><td>TBD</td><td>TBD</td></tr>
              <tr><td>{areas.length + 4}</td><td>All Locations</td><td>End-User Training</td><td>TBD</td><td>1 Hour</td></tr>
              <tr><td>{areas.length + 5}</td><td>All Locations</td><td>Project Closeout</td><td>TBD</td><td>TBD</td></tr>
            </tbody>
          </table>
          <p className="fine">Dates to be confirmed with Point of Contact and HTS Project Manager.</p>
        </section>

        {/* 5. Materials List by Location */}
        <section className="page">
          <h2>4. Materials List by Location</h2>
          <p>All equipment listed below is HTS-provided unless otherwise noted. No substitutions without prior written approval from the HTS Project Manager.</p>
          {materialsByArea.map((m, mi) => (
            <div key={mi} className="mat">
              <h3>{m.areaName.toUpperCase()}</h3>
              <table className="t narrow">
                <thead><tr><th style={{ width: 60 }}>Qty</th><th>Description</th><th style={{ width: 180 }}>MPN</th></tr></thead>
                <tbody>
                  {m.lines.length === 0 ? <tr><td colSpan={3} className="muted">(no devices)</td></tr> :
                    m.lines.map((l, i) => (
                      <tr key={i}>
                        <td>{l.qty}</td>
                        <td>{l.manufacturer ? `${l.manufacturer} ` : ''}{l.description}</td>
                        <td className="mono">{l.mpn}</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          ))}
        </section>

        {/* 6. Installation Details by Location */}
        <section className="page">
          <h2>5. Installation Details by Location</h2>
          {areas.map((a, ai) => (
            <div key={a.id} className="install">
              <h3>5.{ai + 1} {a.name}</h3>
              <ul>
                {a.devices.length === 0 ? <li className="muted">(no devices planned)</li> :
                  a.devices.map(d => {
                    const p = d.properties
                    const vendor = String(p.manufacturer || p.vendor || '')
                    const model = String(p.model || p.partnumber || '')
                    const mount = d.mount_type ? ` on ${d.mount_type} mount` : ''
                    const height = Number(p.install_height) ? ` at ${p.install_height}ft` : ''
                    const cable = d.cableRunFt ? ` Run Cat6 ${d.mdfName ? `to ${d.mdfName}` : 'to IDF'} ~${Math.round(d.cableRunFt)}ft.` : ''
                    const notes = String(p.device_notes || p.notes || '')
                    const action = d.status === 'relocate' ? 'Relocate' : d.status === 'existing_keep' ? 'Retain existing' : d.status === 'existing_remove' ? 'Remove existing' : 'Install'
                    return (
                      <li key={d.id}>
                        <strong>{action}</strong> {vendor} {model} &ldquo;{d.label}&rdquo;{mount}{height}.{cable}
                        {notes ? <> {notes}</> : null}
                      </li>
                    )
                  })
                }
              </ul>
            </div>
          ))}
        </section>

        {/* 7. Site Maps */}
        <section className="page">
          <h2>6. Site Maps &amp; Device Layouts</h2>
          <p>The following site maps show camera placement locations, cable routing, and device models for each location. Refer to these layouts during installation for exact mounting positions and coverage areas.</p>
          {areas.map((a, ai) => (
            <div key={a.id} className="sitemap">
              <h3>6.{ai + 1} {a.name}</h3>
              {a.satellite_lat && a.satellite_lng ? (
                <SiteMap
                  areaId={a.id}
                  mapsKey={mapsKey}
                  lat={a.satellite_lat}
                  lng={a.satellite_lng}
                  zoom={a.satellite_zoom}
                  scalePxPerFt={a.scale_calibration || 4}
                  devices={a.devices.map(d => ({
                    id: d.id, label: d.label, category: d.category, status: d.status,
                    position_x: d.position_x, position_y: d.position_y, rotation: d.rotation,
                    properties: d.properties, cableRunFt: d.cableRunFt, mdfName: d.mdfName,
                  }))}
                  mdfs={a.mdfs.map(m => ({ id: m.id, name: m.name, position_x: m.position_x, position_y: m.position_y }))}
                  walls={a.walls.map(w => ({ id: w.id, points: w.points, color: w.color }))}
                  photos={a.photos.map(p => ({
                    id: p.id, url: p.url, caption: p.caption,
                    lat: p.lat, lng: p.lng, deviceId: p.deviceId,
                  }))}
                />
              ) : (
                <FloorPlanMap
                  areaId={a.id}
                  floorPlanUrl={a.floorPlanUrl}
                  devices={a.devices.map(d => ({
                    id: d.id, label: d.label, category: d.category, status: d.status,
                    position_x: d.position_x, position_y: d.position_y, rotation: d.rotation,
                    cableRunFt: d.cableRunFt, mdfName: d.mdfName,
                  }))}
                  mdfs={a.mdfs.map(m => ({ id: m.id, name: m.name, position_x: m.position_x, position_y: m.position_y }))}
                  walls={a.walls.map(w => ({ id: w.id, points: w.points, color: w.color }))}
                />
              )}
              <div className="caption">{a.devices.length} device(s) · {a.mdfs.length} MDF/IDF · {a.walls.length} wall segments · {a.photos.length} photo(s)</div>
            </div>
          ))}
        </section>

        {/* 8. Wireless P2P */}
        <section className="page">
          <h2>7. Wireless Point-to-Point Installation</h2>
          <ul>
            <li>Label both radios with site/link name, Base vs Remote, and VLAN. Confirm PoE plan.</li>
            <li>Mount high and clear; keep metal obstructions out of main beam path.</li>
            <li>Create a drip loop and route cable downward before entry.</li>
            <li>Use outdoor-rated Cat6 and UV-rated ties/loom; seal exterior penetrations.</li>
            <li>Adopt Base first on head-end LAN, then Remote.</li>
            <li>Acceptance test: Link stable 5–10 min, ping remote endpoints, real traffic test (camera stream).</li>
          </ul>
        </section>

        {/* 9. Programming Guide */}
        <section className="page">
          <h2>8. IP Camera Programming Guide</h2>
          <ol>
            <li>Assign IP address per project IP scheme; document in as-builts.</li>
            <li>Set device name matching the label on the site map.</li>
            <li>Configure VLAN per network design.</li>
            <li>Set NTP server and verify time sync.</li>
            <li>Apply firmware per HTS-approved version.</li>
            <li>Configure resolution, frame rate, and bitrate per RFP.</li>
            <li>Enable ONVIF / VMS integration.</li>
            <li>Verify live view and recording from VMS.</li>
          </ol>
        </section>

        {/* 10. First Day Mobilization */}
        <section className="page">
          <h2>9. First Day Mobilization</h2>
          <ul>
            <li>Check in with site Point of Contact; confirm access, staging, and work area.</li>
            <li>Verify delivered equipment against Materials List.</li>
            <li>Lay out tools, ladders, and PPE; confirm lift requirements for elevated work.</li>
            <li>Review daily scope with crew; identify priority runs and pre-pulls.</li>
            <li>Confirm network uplink / MDF access before starting cable runs.</li>
          </ul>
        </section>

        {/* 11. Install Standards */}
        <section className="page">
          <h2>10. Install Standards</h2>
          <ul>
            <li>Label both ends of every cable run with device ID matching the site map.</li>
            <li>Maintain bend radius per manufacturer specs; no sharp bends or staples.</li>
            <li>Conduit runs for all exposed cabling; seal all exterior penetrations.</li>
            <li>Service loops at MDF/IDF and device end; document lengths.</li>
            <li>Mount to structure (not ceiling tiles) using approved anchors.</li>
            <li>Plumb/level all surface-mount housings; weatherproof outdoor connectors.</li>
          </ul>
        </section>

        {/* 12. Testing */}
        <section className="page">
          <h2>11. Testing &amp; Commissioning</h2>
          <ul>
            <li>Cable cert per TIA-568 standards; record test results per run.</li>
            <li>Verify PoE delivery and link speed at each device.</li>
            <li>Live-view every camera from VMS; confirm image quality and FOV match design.</li>
            <li>Record 24-hour motion capture test on each camera.</li>
            <li>Validate licensing and recording retention.</li>
          </ul>
        </section>

        {/* 13. QC Checklist */}
        <section className="page">
          <h2>12. Quality Control Checklist</h2>
          <ul className="check">
            <li>[ ] All cables labeled at both ends matching site map device IDs.</li>
            <li>[ ] All devices online in VMS / ACM.</li>
            <li>[ ] Firmware at HTS-approved version.</li>
            <li>[ ] FOV matches design intent; no major blind spots.</li>
            <li>[ ] Recording retention validated.</li>
            <li>[ ] Conduit, ties, and penetrations finished cleanly.</li>
            <li>[ ] Service loops present at MDF/IDF and device ends.</li>
            <li>[ ] Work areas clean; ceiling tiles and access panels replaced.</li>
          </ul>
        </section>

        {/* 14. Closeout */}
        <section className="page">
          <h2>13. Project Closeout</h2>
          <ul>
            <li>As-built drawings delivered matching installed configuration.</li>
            <li>Device inventory with serial numbers, IP addresses, and MAC addresses.</li>
            <li>License certificates delivered.</li>
            <li>End-user training completed (one hour, 3–5 users).</li>
            <li>Final walkthrough with site POC; punch list resolved.</li>
            <li>Project sign-off executed.</li>
          </ul>
        </section>

        {/* 14b. Photo Appendix */}
        {appendixPhotos.length > 0 ? (
          <section className="page">
            <h2>{siteReq ? '14' : '14'}. Photo Appendix</h2>
            <p>Site photos referenced on location maps (survey + vault).</p>
            <div className="photo-grid">
              {appendixPhotos.map(p => (
                <div key={`${p.source}-${p.id}`} className="photo-item">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.caption || ''} />
                  <div className="photo-meta">
                    <div className="photo-area">{p.areaName}</div>
                    {p.caption ? <div className="photo-cap">{p.caption}</div> : null}
                    {p.distanceFt != null && p.deviceId ? (
                      <div className="photo-dist">{p.distanceFt}ft from device</div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* 15. Vertical Appendix */}
        {siteReq ? (
          <section className="page">
            <h2>{appendixPhotos.length > 0 ? '15' : '14'}. {siteReq.title}</h2>
            <ul>
              {siteReq.bullets.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          </section>
        ) : null}

        <ReadyMarker areaIds={areas.filter(a => a.satellite_lat && a.satellite_lng).map(a => a.id)} />
      </body>
    </html>
  )
}

const css = `
@page { size: letter; margin: 0.5in; }
* { box-sizing: border-box; }
body { font-family: 'Inter', 'Segoe UI', sans-serif; color: #1a1a1a; font-size: 11pt; margin: 0; padding: 0; }
h1 { font-size: 26pt; margin: 0 0 8pt; color: #522F82; }
h2 { font-size: 16pt; margin: 0 0 10pt; color: #522F82; border-bottom: 2pt solid #522F82; padding-bottom: 4pt; }
h3 { font-size: 13pt; margin: 12pt 0 6pt; color: #333; }
p { margin: 0 0 8pt; line-height: 1.4; }
ul, ol { margin: 0 0 10pt; padding-left: 18pt; line-height: 1.45; }
li { margin-bottom: 3pt; }
.mono { font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace; font-size: 9pt; }
.muted { color: #888; }
.fine { font-size: 9pt; color: #666; margin-top: 6pt; }
.cover { page-break-after: always; padding: 2in 0.3in 0.3in; text-align: center; }
.cover .brand { font-size: 9pt; letter-spacing: 2pt; color: #888; text-transform: uppercase; margin-bottom: 20pt; }
.cover .system { font-size: 13pt; color: #444; margin: 2pt 0 10pt; }
.cover .opp { font-size: 14pt; color: #c0392b; font-weight: 700; margin-bottom: 30pt; }
.cover .info { text-align: left; max-width: 5in; margin: 30pt auto; font-size: 11pt; line-height: 1.6; color: #333; }
.cover .info div { margin-bottom: 3pt; }
.cover .gen { margin-top: 40pt; font-size: 9pt; color: #888; }
.page { page-break-before: always; padding: 0.1in 0; }
.t { width: 100%; border-collapse: collapse; margin: 8pt 0; font-size: 10pt; }
.t th, .t td { border: 0.5pt solid #ccc; padding: 4pt 7pt; text-align: left; vertical-align: top; }
.t th { background: #f5f5f5; font-weight: 600; font-size: 9pt; }
.t.narrow th, .t.narrow td { padding: 3pt 6pt; font-size: 9.5pt; }
.t .tot td { font-weight: 700; background: #fafafa; }
.locations ul { margin: 6pt 0 0; }
.mat { page-break-inside: avoid; margin-bottom: 12pt; }
.install { page-break-inside: avoid; margin-bottom: 12pt; }
.install ul { margin-left: 0; padding-left: 16pt; }
.sitemap { page-break-inside: avoid; margin: 14pt 0; }
.sitemap .caption { font-size: 9pt; color: #666; margin-top: 4pt; }
.nomap { padding: 40pt; text-align: center; background: #f3f4f6; color: #6b7280; font-size: 10pt; border: 0.5pt solid #e5e7eb; }
.check li { list-style: none; }
.photo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10pt; margin-top: 8pt; }
.photo-item { page-break-inside: avoid; border: 0.5pt solid #e5e7eb; background: #fafafa; }
.photo-item img { display: block; width: 100%; height: 130pt; object-fit: cover; }
.photo-meta { padding: 4pt 6pt; font-size: 8.5pt; }
.photo-area { font-weight: 700; color: #522F82; }
.photo-cap { color: #444; margin-top: 1pt; }
.photo-dist { color: #888; font-size: 8pt; margin-top: 1pt; }
`
