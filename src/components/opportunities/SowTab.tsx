'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Upload, ChevronRight, ChevronLeft, FileText, Download, Printer, GripVertical, X, Plus, Zap } from 'lucide-react'
import type { Design, Opportunity } from '@/types/database'

// ── Types ──

interface BomItem { qty: number; vendor: string; pn: string; description: string }
interface SowVariables {
  new_camera_total: number; camera_brand: string; camera_models: string
  exterior_camera_count: number; interior_camera_count: number
  cat6_count: number; cat6_footage: number; relocate_count: number; conduit_footage: number
  ptp_count: number; license_count: number; poe_switch_count: number; switch_models: string
  poe_injector_count: number; mount_count: number
  server_total: number; server_brand: string; nvr_count: number; vms_platform: string
  retention_days: number; project_days: number
}
interface SowSection { id: string; label: string; active: boolean; content: string }
interface ProjectInfo {
  date: string; opp_number: string; customer_name: string; address: string
  city_state: string; project_name: string; engineer: string; work_days: string
  customer_poc: string; customer_email: string; customer_phone: string; customer_vertical: string
  sub_name: string; sub_poc: string; sub_email: string; sub_phone: string
  programming_required: boolean; lift_needed: boolean
}

// ── SOW Section Templates ──

const ALL_SECTIONS: Omit<SowSection, 'active'>[] = [
  { id: 'install_cameras', label: 'Install Cameras according to hardware schedule', content: 'Mount {{new_camera_total}} new {{camera_brand}} cameras ({{camera_models}}).\nAll camera mounting should be secure and level, according to manufacturer specs.\nInstall approved junction boxes where required.\nSeal all exterior penetrations.' },
  { id: 'poe_switches', label: 'PoE Switches', content: 'Provide and install {{poe_switch_count}} PoE switch(es) ({{switch_models}}).\nConnect and verify all ports operational.' },
  { id: 'poe_injectors', label: 'PoE Injectors', content: 'Provide and install {{poe_injector_count}} PoE injector(s).\nVerify power delivery to connected devices.' },
  { id: 'mounts', label: 'Mounts & Accessories', content: 'Provide and install {{mount_count}} mounting accessory set(s) per hardware schedule.' },
  { id: 'cat6_cable', label: 'Provide Cat6 Cabling', content: 'Provide and install {{cat6_count}} new Cat6 data cables.\nEstimated total cable length: approximately {{cat6_footage}} ft.\nProperly support cabling (no ceiling grid support).\nLabel both ends of all cables.\nMaintain separation from high-voltage wiring.' },
  { id: 'cable_termination', label: 'Cable Termination (Cat6)', content: 'Terminate {{cat6_count}} Cat6 cables using punchdowns, keystone jacks, or approved termination hardware as required by site conditions.' },
  { id: 'licenses', label: 'Licenses', content: 'Provide {{license_count}} camera license(s).\nApply and activate all licenses on VMS/cloud platform.' },
  { id: 'wireless_ptp', label: 'Wireless Point-to-Point', content: 'Provide and install {{ptp_count}} wireless point-to-point unit(s).\nAlign and verify link quality for each connection.' },
  { id: 'relocate_cameras', label: 'Relocate Existing Cameras', content: 'Relocate {{relocate_count}} existing cameras to new designated locations as directed.' },
  { id: 'conduit', label: 'Conduit Installation', content: 'Provide and install conduit to protect exposed cabling where required.\nApproximate conduit length: {{conduit_footage}} ft.' },
  { id: 'server_nvr', label: 'Server / NVR', content: 'Install {{server_total}} new {{server_brand}} Server/NVR.\nMount hardware and connect to power/UPS.\nConnect and configure network settings.\nInstall/configure {{vms_platform}}.\nSetup user access configuration.\nApply {{license_count}} camera licenses.\nEnroll up to {{new_camera_total}} cameras.\nConfigure motion, object detection, AI tools.\nConfigure recording profile.\nConfigure retention for approximately {{retention_days}} days.\nTest live view, recording, and playback.' },
  { id: 'access_control', label: 'Install Access Control', content: 'Install and configure access control hardware per hardware schedule.\nProgram door controllers and readers.\nEnroll credentials and set schedules.' },
  { id: 'composite_cable', label: 'Provide Composite Cabling', content: 'Provide and install composite/specialty cabling as specified in hardware schedule.' },
  { id: 'controller_install', label: 'Controller Installation', content: 'Install and mount door controllers per hardware schedule.\nTerminate all field wiring.\nVerify door lock/unlock operation.' },
  { id: 'testing', label: 'Testing & Commissioning', content: 'Test all newly installed and/or relocated cables.\nVerify operational status of all devices.\nConfirm live video/data stream.\nCoordinate with customer for network configuration and final system verification.' },
]

const DEFAULT_ACTIVE = ['install_cameras', 'cat6_cable', 'cable_termination', 'licenses', 'testing']

// ── Merge template variables ──

function mergeTemplate(template: string, vars: SowVariables): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = (vars as unknown as Record<string, unknown>)[key]
    return val !== undefined && val !== null ? String(val) : `{{${key}}}`
  })
}

// ── Props ──

interface Props { oppId: string; opportunity?: Opportunity | null }

// ── Main Component ──

export function SowTab({ oppId, opportunity }: Props) {
  const [step, setStep] = useState(1)
  const [designId, setDesignId] = useState<string | null>(null)
  const [bomItems, setBomItems] = useState<BomItem[]>([])
  const [loading, setLoading] = useState(true)
  const [sections, setSections] = useState<SowSection[]>(
    ALL_SECTIONS.map(s => ({ ...s, active: DEFAULT_ACTIVE.includes(s.id) }))
  )
  const [variables, setVariables] = useState<SowVariables>({
    new_camera_total: 0, camera_brand: '', camera_models: '',
    exterior_camera_count: 0, interior_camera_count: 0,
    cat6_count: 0, cat6_footage: 0, relocate_count: 0, conduit_footage: 0,
    ptp_count: 0, license_count: 0, poe_switch_count: 0, switch_models: '',
    poe_injector_count: 0, mount_count: 0,
    server_total: 0, server_brand: '', nvr_count: 0, vms_platform: '',
    retention_days: 30, project_days: 1,
  })
  const [projectInfo, setProjectInfo] = useState<ProjectInfo>({
    date: new Date().toLocaleDateString(), opp_number: opportunity?.opp_number || '',
    customer_name: opportunity?.customer_name || '', address: opportunity?.install_address || '',
    city_state: opportunity?.state || '', project_name: opportunity?.project_name || '',
    engineer: '', work_days: '', customer_poc: '', customer_email: '', customer_phone: '',
    customer_vertical: 'BIZ', sub_name: '', sub_poc: '', sub_email: '', sub_phone: '',
    programming_required: false, lift_needed: false,
  })
  const [programmingNotes, setProgrammingNotes] = useState('')
  const [sowPreviewOverride, setSowPreviewOverride] = useState<string | null>(null)

  // ── Step 1: Load design data ──
  const loadDesignData = useCallback(async () => {
    setLoading(true)
    try {
      const dRes = await fetch('/api/org/designs')
      if (!dRes.ok) { setLoading(false); return }
      const { designs } = await dRes.json()
      const oppDesign = (designs ?? []).find((d: Design) => d.opp_id === oppId)
      if (!oppDesign) { setLoading(false); return }
      setDesignId(oppDesign.id)

      // Fetch BOM
      const bRes = await fetch(`/api/org/designs/${oppDesign.id}/export/bom`, { method: 'POST' })
      if (bRes.ok) {
        const bom = await bRes.json()
        const items: BomItem[] = (bom.items ?? []).map((i: Record<string, unknown>) => ({
          qty: Number(i.qty) || 0, vendor: String(i.manufacturer || ''),
          pn: String(i.model || ''), description: String(i.label || ''),
        }))
        setBomItems(items)

        // Auto-compute variables from BOM
        const totalCams = items.reduce((s, i) => {
          const desc = (i.description + i.pn).toLowerCase()
          return s + (desc.includes('cam') || desc.includes('bullet') || desc.includes('dome') || desc.includes('ptz') || desc.includes('turret') ? i.qty : 0)
        }, 0)
        const brand = items.find(i => i.qty > 0)?.vendor || ''
        const models = items.filter(i => i.qty > 0).map(i => i.pn).join(', ')
        const licenseItems = items.filter(i => (i.description + i.pn).toLowerCase().includes('lic'))
        const switchItems = items.filter(i => (i.description + i.pn).toLowerCase().includes('switch') || (i.description + i.pn).toLowerCase().includes('poe'))
        const injectorItems = items.filter(i => (i.description + i.pn).toLowerCase().includes('injector'))
        const ptpItems = items.filter(i => (i.description + i.pn).toLowerCase().includes('point') || (i.description + i.pn).toLowerCase().includes('wave'))

        setVariables(prev => ({
          ...prev,
          new_camera_total: totalCams,
          camera_brand: brand,
          camera_models: models,
          license_count: licenseItems.reduce((s, i) => s + i.qty, 0),
          poe_switch_count: switchItems.reduce((s, i) => s + i.qty, 0),
          switch_models: switchItems.map(i => i.pn).join(', '),
          poe_injector_count: injectorItems.reduce((s, i) => s + i.qty, 0),
          ptp_count: ptpItems.reduce((s, i) => s + i.qty, 0),
          mount_count: items.filter(i => (i.description + i.pn).toLowerCase().includes('mount')).reduce((s, i) => s + i.qty, 0),
        }))

        // Auto-activate sections based on what's in the BOM
        setSections(prev => prev.map(s => {
          if (s.id === 'poe_switches' && switchItems.length > 0) return { ...s, active: true }
          if (s.id === 'poe_injectors' && injectorItems.length > 0) return { ...s, active: true }
          if (s.id === 'wireless_ptp' && ptpItems.length > 0) return { ...s, active: true }
          if (s.id === 'mounts' && items.some(i => (i.description + i.pn).toLowerCase().includes('mount'))) return { ...s, active: true }
          return s
        }))
      }

      // Fetch cables for footage
      const cRes = await fetch(`/api/org/designs/${oppDesign.id}/export/cable-schedule`, { method: 'POST' })
      if (cRes.ok) {
        const cables = await cRes.json()
        setVariables(prev => ({
          ...prev,
          cat6_count: (cables.cables ?? []).length,
          cat6_footage: cables.totalFootage ?? 0,
        }))
      }
    } finally { setLoading(false) }
  }, [oppId])

  useEffect(() => { loadDesignData() }, [loadDesignData])

  // Update project info when opportunity changes
  useEffect(() => {
    if (!opportunity) return
    setProjectInfo(prev => ({
      ...prev,
      opp_number: opportunity.opp_number || prev.opp_number,
      customer_name: opportunity.customer_name || prev.customer_name,
      address: opportunity.install_address || prev.address,
      city_state: opportunity.state || prev.city_state,
      project_name: opportunity.project_name || prev.project_name,
    }))
  }, [opportunity])

  // ── Generated SOW text ──
  const generatedSow = useMemo(() => {
    const activeSections = sections.filter(s => s.active)
    return activeSections.map((s, i) =>
      `${i + 1}. ${s.label}\n\n${mergeTemplate(s.content, variables)}`
    ).join('\n\n')
  }, [sections, variables])

  const displaySow = sowPreviewOverride ?? generatedSow

  // ── SOW DOCX generation ──
  const generateDocx = useCallback(async (type: 'rfp_sub' | 'sow_sub' | 'customer') => {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx')

    const title = type === 'rfp_sub' ? 'RFP — Subcontractor Labor Quote'
      : type === 'sow_sub' ? 'Subcontractor Statement of Work'
      : 'Customer Statement of Work'

    const children = [
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: title, font: 'Arial' })] }),
      new Paragraph({ children: [new TextRun({ text: `${projectInfo.project_name} — ${projectInfo.opp_number}`, font: 'Arial', size: 24, bold: true })] }),
      new Paragraph({ children: [new TextRun({ text: `Customer: ${projectInfo.customer_name}`, font: 'Arial', size: 20 })] }),
      new Paragraph({ children: [new TextRun({ text: `Address: ${projectInfo.address}, ${projectInfo.city_state}`, font: 'Arial', size: 20 })] }),
      new Paragraph({ children: [new TextRun({ text: `Date: ${projectInfo.date}`, font: 'Arial', size: 20 })] }),
      new Paragraph({ children: [] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: 'Scope of Work', font: 'Arial' })] }),
    ]

    // Add each active section
    const activeSections = sections.filter(s => s.active)
    for (let i = 0; i < activeSections.length; i++) {
      const s = activeSections[i]
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text: `${i + 1}. ${s.label}`, font: 'Arial' })] }))
      const merged = mergeTemplate(s.content, variables)
      for (const line of merged.split('\n')) {
        children.push(new Paragraph({ children: [new TextRun({ text: line, font: 'Arial', size: 20 })] }))
      }
    }

    // Material list
    if (bomItems.length > 0) {
      children.push(new Paragraph({ children: [] }))
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: 'Material List', font: 'Arial' })] }))
      for (const item of bomItems) {
        children.push(new Paragraph({ children: [new TextRun({ text: `${item.qty}x ${item.vendor} ${item.pn} — ${item.description}`, font: 'Arial', size: 20 })] }))
      }
    }

    // Programming notes
    if (programmingNotes && type === 'sow_sub') {
      children.push(new Paragraph({ children: [] }))
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: 'Programming Notes', font: 'Arial' })] }))
      for (const line of programmingNotes.split('\n')) {
        children.push(new Paragraph({ children: [new TextRun({ text: line, font: 'Arial', size: 20 })] }))
      }
    }

    // Signature block for customer SOW
    if (type === 'customer') {
      children.push(new Paragraph({ children: [] }))
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: 'Acceptance', font: 'Arial' })] }))
      children.push(new Paragraph({ children: [new TextRun({ text: '______________________________          ______________________________', font: 'Arial', size: 20 })] }))
      children.push(new Paragraph({ children: [new TextRun({ text: 'Customer Signature / Date                    Contractor Signature / Date', font: 'Arial', size: 16, color: '888888' })] }))
    }

    const doc = new Document({
      sections: [{
        properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        children,
      }],
    })
    const blob = await Packer.toBlob(doc)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${projectInfo.project_name || 'SOW'}_${type}.docx`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [sections, variables, bomItems, projectInfo, programmingNotes])

  // ── Render ──

  if (loading) return <div className="p-8 text-center text-sm text-muted-foreground">Loading design data...</div>

  const stepLabels = ['Data Source', 'Project Info', 'Scope of Work', 'Preview & Edit', 'Export']

  return (
    <div>
      {/* Step indicator */}
      <div className="flex items-center gap-0 mb-4">
        {stepLabels.map((label, i) => {
          const num = i + 1
          const active = step === num
          const done = step > num
          return (
            <div key={num} className="flex items-center">
              <button onClick={() => setStep(num)} className="flex items-center gap-1.5">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  done ? 'bg-primary text-primary-foreground' : active ? 'bg-primary text-primary-foreground ring-2 ring-primary/30' : 'bg-muted text-muted-foreground'
                }`}>{done ? '✓' : num}</div>
                <span className={`text-[10px] font-medium ${active ? 'text-primary' : 'text-muted-foreground'}`}>{label}</span>
              </button>
              {i < 4 && <div className={`w-8 h-0.5 mx-1 ${done ? 'bg-primary' : 'bg-border'}`} />}
            </div>
          )
        })}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mb-4">
        {step > 1 ? <button onClick={() => setStep(step - 1)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ChevronLeft className="h-3 w-3" /> Back</button> : <div />}
        {step < 5 ? <button onClick={() => setStep(step + 1)} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">Continue <ChevronRight className="h-3 w-3" /></button> : <div />}
      </div>

      {/* ═══ Step 1: Data Source ═══ */}
      {step === 1 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Data Source</span>
          </div>
          {designId ? (
            <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-center gap-2 text-xs text-primary font-medium">
                <Zap className="h-3.5 w-3.5" /> Pulled from Design Canvas
              </div>
              <div className="text-xs text-muted-foreground mt-1">{bomItems.length} line items loaded</div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">No design linked to this opportunity. Create a design first, or upload a BOM file.</div>
          )}
          {bomItems.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-semibold text-foreground mb-2">Material List ({bomItems.length})</div>
              <div className="rounded border border-border overflow-hidden">
                <table className="w-full text-[10px]">
                  <thead><tr className="bg-muted/50 border-b border-border"><th className="px-2 py-1 text-left font-semibold text-muted-foreground">Qty</th><th className="px-2 py-1 text-left font-semibold text-muted-foreground">Vendor</th><th className="px-2 py-1 text-left font-semibold text-muted-foreground">P/N</th><th className="px-2 py-1 text-left font-semibold text-muted-foreground">Description</th></tr></thead>
                  <tbody>{bomItems.map((item, i) => (
                    <tr key={i} className="border-b border-border"><td className="px-2 py-1 font-mono font-bold">{item.qty}</td><td className="px-2 py-1">{item.vendor}</td><td className="px-2 py-1 font-mono">{item.pn}</td><td className="px-2 py-1">{item.description}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ Step 2: Project Info ═══ */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Project</div>
            <div className="grid grid-cols-4 gap-3">
              {([['date', 'Date'], ['opp_number', 'OPP Number'], ['customer_name', 'Customer Name'], ['address', 'Address'],
                ['city_state', 'City / State / Zip'], ['project_name', 'Project Name'], ['engineer', 'Solution Architect'], ['work_days', 'Work Days']] as const).map(([key, label]) => (
                <div key={key}><div className="text-[9px] text-muted-foreground mb-0.5">{label}</div>
                  <input value={projectInfo[key] as string} onChange={e => setProjectInfo(p => ({ ...p, [key]: e.target.value }))}
                    className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring" /></div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Customer</div>
              {([['customer_name', 'Customer Name'], ['customer_poc', 'Point of Contact'], ['customer_email', 'Email'], ['customer_phone', 'Phone']] as const).map(([key, label]) => (
                <div key={key} className="mb-2"><div className="text-[9px] text-muted-foreground mb-0.5">{label}</div>
                  <input value={projectInfo[key] as string} onChange={e => setProjectInfo(p => ({ ...p, [key]: e.target.value }))}
                    className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring" /></div>
              ))}
            </div>
            <div className="rounded-lg border border-primary/20 bg-card p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-primary mb-3">Subcontractor</div>
              {([['sub_name', 'Subcontractor'], ['sub_poc', 'PoC'], ['sub_email', 'Email'], ['sub_phone', 'Phone']] as const).map(([key, label]) => (
                <div key={key} className="mb-2"><div className="text-[9px] text-muted-foreground mb-0.5">{label}</div>
                  <input value={projectInfo[key] as string} onChange={e => setProjectInfo(p => ({ ...p, [key]: e.target.value }))}
                    className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring" /></div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Other Info</div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={projectInfo.programming_required} onChange={e => setProjectInfo(p => ({ ...p, programming_required: e.target.checked }))} className="accent-primary" /> Programming Required</label>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={projectInfo.lift_needed} onChange={e => setProjectInfo(p => ({ ...p, lift_needed: e.target.checked }))} className="accent-primary" /> Lift Needed</label>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Step 3: Scope of Work ═══ */}
      {step === 3 && (
        <SowStep3Content sections={sections} setSections={setSections} variables={variables} setVariables={setVariables}
          programmingNotes={programmingNotes} setProgrammingNotes={setProgrammingNotes} generatedSow={displaySow} />
      )}

      {/* ═══ Step 4: Preview & Edit ═══ */}
      {step === 4 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs font-semibold mb-2">Generated Scope of Work</div>
          <div className="text-[9px] text-muted-foreground mb-2">Edit below to customize. Changes override the generated content.</div>
          <textarea value={displaySow} onChange={e => setSowPreviewOverride(e.target.value)} rows={20}
            className="w-full rounded border border-border bg-background p-3 text-xs font-mono outline-none focus:ring-1 focus:ring-ring leading-relaxed" />
        </div>
      )}

      {/* ═══ Step 5: Export ═══ */}
      {step === 5 && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Download className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Export Documents</span>
            </div>
            <div className="text-xs text-muted-foreground mb-4">Download your SOW documents as Word files.</div>
            <div className="grid grid-cols-3 gap-3">
              {([
                { type: 'rfp_sub' as const, label: 'RFP SUB', desc: 'Labor quoting SOW for subcontractor' },
                { type: 'sow_sub' as const, label: 'SOW SUB Project', desc: 'Execution SOW for subcontractor' },
                { type: 'customer' as const, label: 'Customer SOW', desc: 'Customer-facing statement of work' },
              ]).map(doc => (
                <button key={doc.type} onClick={() => generateDocx(doc.type)}
                  className="rounded-lg border border-border bg-background p-4 text-left hover:border-primary/30 hover:shadow-sm transition-all">
                  <FileText className="h-5 w-5 text-primary mb-2" />
                  <div className="text-xs font-semibold">{doc.label}</div>
                  <div className="text-[9px] text-muted-foreground mt-1">{doc.desc}</div>
                  <div className="text-[9px] font-bold text-primary mt-2">.docx</div>
                </button>
              ))}
            </div>
          </div>
          {projectInfo.lift_needed && (
            <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive font-medium">
              ⚠ Lift requirements will be appended to the SOW documents.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Step 3 sub-component (manages its own tab state) ──

function SowStep3Content({ sections, setSections, variables, setVariables, programmingNotes, setProgrammingNotes, generatedSow }: {
  sections: SowSection[]; setSections: (fn: (prev: SowSection[]) => SowSection[]) => void
  variables: SowVariables; setVariables: (fn: (prev: SowVariables) => SowVariables) => void
  programmingNotes: string; setProgrammingNotes: (v: string) => void; generatedSow: string
}) {
  const [tab, setTab] = useState<'Sections' | 'Variables' | 'Programming'>('Sections')
  const activeSections = sections.filter(s => s.active)
  const availableSections = sections.filter(s => !s.active)

  return (
    <div>
      <div className="flex border-b border-border mb-3">
        {(['Sections', 'Variables', 'Programming'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{t}</button>
        ))}
      </div>

      {tab === 'Sections' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] font-bold text-muted-foreground mb-2">IN USE ({activeSections.length})</div>
            <div className="space-y-1">
              {activeSections.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2 rounded border border-border bg-card px-2 py-1.5 text-xs">
                  <GripVertical className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />
                  <span className="text-muted-foreground font-mono text-[9px]">{i + 1}.</span>
                  <span className="flex-1 truncate">{s.label}</span>
                  <button onClick={() => setSections(prev => prev.map(ss => ss.id === s.id ? { ...ss, active: false } : ss))}
                    className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-muted-foreground mb-2">AVAILABLE ({availableSections.length})</div>
            <div className="space-y-1">
              {availableSections.map(s => (
                <button key={s.id} onClick={() => setSections(prev => prev.map(ss => ss.id === s.id ? { ...ss, active: true } : ss))}
                  className="flex items-center gap-2 w-full rounded border border-dashed border-border px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors text-left">
                  <Plus className="h-3 w-3 text-primary flex-shrink-0" />
                  <span className="truncate">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'Variables' && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs font-semibold mb-1">SOW Variables</div>
          <div className="text-[9px] text-muted-foreground mb-3">Values auto-filled from your BOM are marked with ⚡. You can override any value.</div>
          <div className="grid grid-cols-2 gap-3">
            {([
              ['new_camera_total', 'New Camera Total', true], ['camera_brand', 'Camera Brand', true],
              ['camera_models', 'Camera Models', true], ['exterior_camera_count', 'Exterior Camera Count', false],
              ['interior_camera_count', 'Interior Camera Count', false], ['cat6_count', 'Cat6 Cable Count', true],
              ['cat6_footage', 'Cat6 Footage (ft)', true], ['relocate_count', 'Relocate Count', false],
              ['conduit_footage', 'Conduit Footage (ft)', false], ['ptp_count', 'Point-to-Point Count', true],
              ['license_count', 'License Count', true], ['poe_switch_count', 'PoE Switch Count', true],
              ['switch_models', 'Switch Models', true], ['poe_injector_count', 'PoE Injector Count', true],
              ['mount_count', 'Mount/Accessory Count', true], ['server_total', 'Server/NVR Count', false],
              ['server_brand', 'Server/NVR Brand', false], ['nvr_count', 'NVR Count', false],
              ['vms_platform', 'VMS Platform', false], ['retention_days', 'Retention Days', false],
            ] as [keyof SowVariables, string, boolean][]).map(([key, label, autoFilled]) => (
              <div key={key}>
                <div className="text-[9px] text-muted-foreground mb-0.5">{label} {autoFilled && <span className="text-amber-500">⚡</span>}</div>
                <input value={String(variables[key])} onChange={e => setVariables(prev => ({
                  ...prev, [key]: typeof prev[key] === 'number' ? Number(e.target.value) || 0 : e.target.value
                }))} className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring" />
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'Programming' && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs font-semibold mb-1">Programming Notes</div>
          <div className="text-[9px] text-muted-foreground mb-2">Programming notes are exported separately — they populate the SOW SUB Project document.</div>
          <textarea value={programmingNotes} onChange={e => setProgrammingNotes(e.target.value)} rows={8}
            placeholder="Enter programming details, e.g.:\nConfigure IP addresses for all cameras\nUpdate firmware to latest version\nProgram access control panels\nEnroll credentials and set schedules\nConfigure VMS recording profiles"
            className="w-full rounded border border-border bg-background p-3 text-xs font-mono outline-none focus:ring-1 focus:ring-ring leading-relaxed" />
        </div>
      )}

      {/* Generated preview below all tabs */}
      <div className="mt-4 rounded-lg border border-border bg-card p-4">
        <div className="text-xs font-semibold mb-1">Generated Scope of Work Preview</div>
        <div className="text-[9px] text-muted-foreground mb-2">This is the merged output from your sections + variables.</div>
        <pre className="whitespace-pre-wrap text-xs font-mono text-muted-foreground bg-muted/30 rounded p-3 max-h-60 overflow-auto leading-relaxed">{generatedSow}</pre>
      </div>
    </div>
  )
}

