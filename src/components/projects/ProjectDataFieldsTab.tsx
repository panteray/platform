'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import type { Project } from '@/types/database'
import {
  Hash, Calendar, Truck, ClipboardCheck, FileText,
  Users as UsersIcon, Phone, Shield, Wrench, DollarSign,
} from 'lucide-react'

type User = { id: string; first_name: string | null; last_name: string | null; email: string }
type Subcontractor = { id: string; name: string }

type ExtendedProject = Project & Record<string, unknown>

interface Props {
  project: Project
  onUpdate: (p: Project) => void
}

export function ProjectDataFieldsTab({ project, onUpdate }: Props) {
  const [users, setUsers] = useState<User[]>([])
  const [subs, setSubs] = useState<Subcontractor[]>([])
  const [local, setLocal] = useState<ExtendedProject>(project as ExtendedProject)
  const [saving, setSaving] = useState<string | null>(null)
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => { setLocal(project as ExtendedProject) }, [project])

  useEffect(() => {
    fetch('/api/org/users').then(r => r.ok ? r.json() : []).then(setUsers).catch(() => {})
    fetch('/api/org/subcontractors').then(r => r.ok ? r.json() : []).then(setSubs).catch(() => {})
  }, [])

  const saveField = useCallback(async (field: string, value: unknown) => {
    setSaving(field)
    try {
      const res = await fetch(`/api/org/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value === '' ? null : value }),
      })
      if (res.ok) {
        const updated = await res.json()
        onUpdate({ ...local, ...updated })
      }
    } finally {
      setSaving(null)
    }
  }, [project.id, local, onUpdate])

  const onChange = (field: string, value: unknown) => {
    setLocal(prev => ({ ...prev, [field]: value }))
    const existing = timers.current.get(field)
    if (existing) clearTimeout(existing)
    timers.current.set(field, setTimeout(() => saveField(field, value), 500))
  }

  const val = (k: string) => (local[k] as string | number | boolean | null | undefined) ?? ''

  return (
    <div className="space-y-6">
      <Section title="Identity & Routing" icon={<Hash className="h-4 w-4 text-blue-500" />}>
        <TextField label="OPP #" value={(local.opportunity as { opp_number?: string } | undefined)?.opp_number ?? ''} readOnly />
        <TextField label="PN" field="pn" value={String(val('pn'))} onChange={onChange} saving={saving} />
        <TextField label="Order #" field="order_number" value={String(val('order_number'))} onChange={onChange} saving={saving} />
        <DateField label="Order Date" field="order_date" value={String(val('order_date'))} onChange={onChange} saving={saving} />
        <DateField label="Date Submitted" field="date_submitted" value={String(val('date_submitted'))} onChange={onChange} saving={saving} />
        <TextField label="Customer #" field="customer_number" value={String(val('customer_number'))} onChange={onChange} saving={saving} />
        <TextField label="Project Type" field="project_type" value={String(val('project_type'))} onChange={onChange} saving={saving} />
        <TextField label="Vertical" field="vertical" value={String(val('vertical'))} onChange={onChange} saving={saving} />
        <TextField label="Campus / Bldg / Rm #" field="campus_building_room" value={String(val('campus_building_room'))} onChange={onChange} saving={saving} wide />
        <TextField label="Install Address" field="install_address" value={String(val('install_address'))} onChange={onChange} saving={saving} wide />
        <TextareaField label="PM Comments" field="pm_comments" value={String(val('pm_comments'))} onChange={onChange} saving={saving} />
      </Section>

      <Section title="Status" icon={<ClipboardCheck className="h-4 w-4 text-emerald-500" />}>
        <TextField label="Ship Status" field="ship_status" value={String(val('ship_status'))} onChange={onChange} saving={saving} />
        <TextField label="Operation Status" field="operation_status" value={String(val('operation_status'))} onChange={onChange} saving={saving} />
        <TextField label="Sign-off Status" field="signoff_status" value={String(val('signoff_status'))} onChange={onChange} saving={saving} />
        <TextField label="Closeout Status" field="closeout_status" value={String(val('closeout_status'))} onChange={onChange} saving={saving} />
      </Section>

      <Section title="Dates & Aging" icon={<Calendar className="h-4 w-4 text-amber-500" />}>
        <DateField label="Approx Install Date" field="approx_install_date" value={String(val('approx_install_date'))} onChange={onChange} saving={saving} />
        <DateField label="Tentative Date" field="tentative_date" value={String(val('tentative_date'))} onChange={onChange} saving={saving} />
        <DateField label="Confirmed Scheduled Date" field="confirmed_scheduled_date" value={String(val('confirmed_scheduled_date'))} onChange={onChange} saving={saving} />
        <DateField label="Est Completion Date" field="est_completion_date" value={String(val('est_completion_date'))} onChange={onChange} saving={saving} />
        <DateField label="Actual End Date" field="actual_end_date" value={String(val('actual_end_date'))} onChange={onChange} saving={saving} />
        <DateField label="Actual Equip Delivery Date" field="actual_equip_delivery_date" value={String(val('actual_equip_delivery_date'))} onChange={onChange} saving={saving} />
        <DateField label="Equip Paid Date" field="equip_paid_date" value={String(val('equip_paid_date'))} onChange={onChange} saving={saving} />
        <AgingBadge label="Order Aging" from={val('order_date') as string | null} to={val('actual_equip_delivery_date') as string | null} />
        <AgingBadge label="Delivery Aging" from={val('actual_equip_delivery_date') as string | null} to={val('actual_end_date') as string | null} />
      </Section>

      <Section title="RMA & Invoicing" icon={<FileText className="h-4 w-4 text-rose-500" />}>
        <DateField label="RMA Processing Date" field="rma_processing_date" value={String(val('rma_processing_date'))} onChange={onChange} saving={saving} />
        <TextField label="RMA #" field="rma_number" value={String(val('rma_number'))} onChange={onChange} saving={saving} />
        <DateField label="Invoice Received" field="invoice_received_date" value={String(val('invoice_received_date'))} onChange={onChange} saving={saving} />
        <TextField label="Invoice #" field="invoice_number" value={String(val('invoice_number'))} onChange={onChange} saving={saving} />
        <DateField label="Invoice Processed" field="invoice_processed_date" value={String(val('invoice_processed_date'))} onChange={onChange} saving={saving} />
        <DateField label="SOS Sent" field="sos_sent_date" value={String(val('sos_sent_date'))} onChange={onChange} saving={saving} />
        <DateField label="SOS Received" field="sos_received_date" value={String(val('sos_received_date'))} onChange={onChange} saving={saving} />
        <BoolField label="Quote Received?" field="quote_received" value={Boolean(val('quote_received'))} onChange={onChange} saving={saving} />
        <BoolField label="PO Sent?" field="po_sent" value={Boolean(val('po_sent'))} onChange={onChange} saving={saving} />
      </Section>

      <Section title="Personnel" icon={<UsersIcon className="h-4 w-4 text-violet-500" />}>
        <PersonField label="Resource Coordinator" idField="resource_coordinator_id" textField="resource_coordinator_text" local={local} users={users} onChange={onChange} saving={saving} />
        <PersonField label="Technical Supervisor" idField="technical_supervisor_id" textField="technical_supervisor_text" local={local} users={users} onChange={onChange} saving={saving} />
        <PersonField label="Lead Tech" idField="lead_tech_id" textField="lead_tech_text" local={local} users={users} onChange={onChange} saving={saving} />
        <TextField label="Technicians" field="technicians_text" value={String(val('technicians_text'))} onChange={onChange} saving={saving} wide />
        <PersonField label="Outside PM" idField="outside_pm_id" textField="outside_pm_text" local={local} users={users} onChange={onChange} saving={saving} />
        <PersonField label="PM Mentor" idField="pm_mentor_id" textField="pm_mentor_text" local={local} users={users} onChange={onChange} saving={saving} />
        <PersonField label="Service Coordinator" idField="service_coordinator_id" textField="service_coordinator_text" local={local} users={users} onChange={onChange} saving={saving} />
        <PersonField label="Inside Sales" idField="inside_sales_id" textField="inside_sales_text" local={local} users={users} onChange={onChange} saving={saving} />
        <PersonField label="Outside Sales" idField="outside_sales_id" textField="outside_sales_text" local={local} users={users} onChange={onChange} saving={saving} />
        <SubField label="Subcontractor (Labor)" idField="subcontractor_labor_id" textField="subcontractor_labor_text" local={local} subs={subs} onChange={onChange} saving={saving} />
        <SubField label="Subcontractor (Programming)" idField="subcontractor_programming_id" textField="subcontractor_programming_text" local={local} subs={subs} onChange={onChange} saving={saving} />
      </Section>

      <Section title="Point of Contact" icon={<Phone className="h-4 w-4 text-cyan-500" />}>
        <TextField label="POC Name" field="poc_name" value={String(val('poc_name'))} onChange={onChange} saving={saving} />
        <TextField label="POC Phone" field="poc_phone" value={String(val('poc_phone'))} onChange={onChange} saving={saving} />
        <TextField label="POC Email" field="poc_email" value={String(val('poc_email'))} onChange={onChange} saving={saving} />
      </Section>

      <Section title="Program & Contract" icon={<Shield className="h-4 w-4 text-indigo-500" />}>
        <BoolField label="ERATE" field="erate" value={Boolean(val('erate'))} onChange={onChange} saving={saving} />
        <BoolField label="90-day Warranty" field="warranty_90_day" value={Boolean(val('warranty_90_day'))} onChange={onChange} saving={saving} />
        <TextField label="Contract Type" field="contract_type" value={String(val('contract_type'))} onChange={onChange} saving={saving} />
        <BoolField label="Multiple Install Lines" field="multiple_install_lines" value={Boolean(val('multiple_install_lines'))} onChange={onChange} saving={saving} />
        <BoolField label="Multiple Program Lines" field="multiple_program_lines" value={Boolean(val('multiple_program_lines'))} onChange={onChange} saving={saving} />
        <TextareaField label="Program Requirements" field="program_requirements" value={String(val('program_requirements'))} onChange={onChange} saving={saving} />
      </Section>

      <Section title="SSC (Service Contract)" icon={<Wrench className="h-4 w-4 text-orange-500" />}>
        <BoolField label="SSC Active" field="ssc_active" value={Boolean(val('ssc_active'))} onChange={onChange} saving={saving} />
        <TextField label="SSC Status" field="ssc_status" value={String(val('ssc_status'))} onChange={onChange} saving={saving} />
        <TextField label="SSC Duration" field="ssc_duration" value={String(val('ssc_duration'))} onChange={onChange} saving={saving} />
        <DateField label="SSC Term Date" field="ssc_term_date" value={String(val('ssc_term_date'))} onChange={onChange} saving={saving} />
        <TextField label="Renewal #" field="ssc_renewal_number" value={String(val('ssc_renewal_number'))} onChange={onChange} saving={saving} />
        <NumField label="Block Hours Approved" field="ssc_block_hours_approved" value={val('ssc_block_hours_approved') as number | string} onChange={onChange} saving={saving} />
        <NumField label="Block Hours Used" field="ssc_block_hours_used" value={val('ssc_block_hours_used') as number | string} onChange={onChange} saving={saving} />
        <NumField label="Block Hours Remaining" field="ssc_block_hours_remaining" value={val('ssc_block_hours_remaining') as number | string} onChange={onChange} saving={saving} />
        <BoolField label="SSC Forced?" field="ssc_forced" value={Boolean(val('ssc_forced'))} onChange={onChange} saving={saving} />
        <NumField label="SSC Charged" field="ssc_charged" value={val('ssc_charged') as number | string} onChange={onChange} saving={saving} currency />
        <BoolField label="SSC to Finance Invoice" field="ssc_to_finance_invoice" value={Boolean(val('ssc_to_finance_invoice'))} onChange={onChange} saving={saving} />
        <BoolField label="Satisfaction Survey Sent" field="satisfaction_survey_sent" value={Boolean(val('satisfaction_survey_sent'))} onChange={onChange} saving={saving} />
      </Section>

      <Section title="Financials" icon={<DollarSign className="h-4 w-4 text-green-500" />}>
        <NumField label="Order Amount" field="order_amount" value={val('order_amount') as number | string} onChange={onChange} saving={saving} currency />
        <NumField label="Equipment Cost" field="equipment_cost" value={val('equipment_cost') as number | string} onChange={onChange} saving={saving} currency />
        <NumField label="Labor (Customer)" field="labor_customer_cost" value={val('labor_customer_cost') as number | string} onChange={onChange} saving={saving} currency />
        <NumField label="Labor Cost Only" field="labor_cost_only" value={val('labor_cost_only') as number | string} onChange={onChange} saving={saving} currency />
        <NumField label="Misc BOM" field="misc_bom" value={val('misc_bom') as number | string} onChange={onChange} saving={saving} currency />
        <NumField label="Misc Labor" field="misc_labor" value={val('misc_labor') as number | string} onChange={onChange} saving={saving} currency />
        <NumField label="Lift Rental" field="lift_rental" value={val('lift_rental') as number | string} onChange={onChange} saving={saving} currency />
        <NumField label="Programming (Customer)" field="programming_customer_cost" value={val('programming_customer_cost') as number | string} onChange={onChange} saving={saving} currency />
        <NumField label="Programming (Material)" field="programming_material_cost" value={val('programming_material_cost') as number | string} onChange={onChange} saving={saving} currency />
        <NumField label="SSC (Customer)" field="ssc_customer_cost" value={val('ssc_customer_cost') as number | string} onChange={onChange} saving={saving} currency />
        <NumField label="SSC (Material)" field="ssc_material_cost" value={val('ssc_material_cost') as number | string} onChange={onChange} saving={saving} currency />
        <NumField label="Contingency" field="contingency_amount" value={val('contingency_amount') as number | string} onChange={onChange} saving={saving} currency />
        <NumField label="Sub Quote Amount" field="sub_quote_amount" value={val('sub_quote_amount') as number | string} onChange={onChange} saving={saving} currency />
        <NumField label="Sub Cost (Parts+Labor)" field="sub_cost_parts_labor" value={val('sub_cost_parts_labor') as number | string} onChange={onChange} saving={saving} currency />
        <NumField label="HTS Technician Cost" field="hts_technician_cost" value={val('hts_technician_cost') as number | string} onChange={onChange} saving={saving} currency />
        <NumField label="Job Materials Cost" field="job_materials_cost" value={val('job_materials_cost') as number | string} onChange={onChange} saving={saving} currency />
        <NumField label="Misc Job Costs" field="misc_job_costs" value={val('misc_job_costs') as number | string} onChange={onChange} saving={saving} currency />
        <NumField label="Shipping Cost" field="shipping_cost" value={val('shipping_cost') as number | string} onChange={onChange} saving={saving} currency />
        <NumField label="Project Balance" field="project_balance" value={val('project_balance') as number | string} onChange={onChange} saving={saving} currency />
      </Section>

      <Section title="Shipping" icon={<Truck className="h-4 w-4 text-sky-500" />}>
        <TextField label="Shipping Company" field="shipping_company" value={String(val('shipping_company'))} onChange={onChange} saving={saving} wide />
      </Section>
    </div>
  )
}

// ============================================================================
// Subcomponents
// ============================================================================

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        {icon}
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
    </div>
  )
}

function FieldShell({ label, wide, saving, children }: { label: string; wide?: boolean; saving?: boolean; children: React.ReactNode }) {
  return (
    <label className={`flex flex-col gap-1 ${wide ? 'sm:col-span-2 lg:col-span-3' : ''}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        {label}
        {saving && <span className="text-[9px] font-normal text-primary animate-pulse">saving…</span>}
      </span>
      {children}
    </label>
  )
}

const inputCls = 'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary'

function TextField({ label, field, value, onChange, saving, wide, readOnly }: {
  label: string; field?: string; value: string;
  onChange?: (f: string, v: unknown) => void; saving?: string | null; wide?: boolean; readOnly?: boolean
}) {
  return (
    <FieldShell label={label} wide={wide} saving={saving === field}>
      <input
        type="text"
        value={value ?? ''}
        readOnly={readOnly}
        onChange={e => field && onChange?.(field, e.target.value)}
        className={`${inputCls} ${readOnly ? 'cursor-not-allowed bg-muted' : ''}`}
      />
    </FieldShell>
  )
}

function TextareaField({ label, field, value, onChange, saving }: {
  label: string; field: string; value: string;
  onChange: (f: string, v: unknown) => void; saving: string | null
}) {
  return (
    <FieldShell label={label} wide saving={saving === field}>
      <textarea
        value={value ?? ''}
        onChange={e => onChange(field, e.target.value)}
        rows={2}
        className={inputCls}
      />
    </FieldShell>
  )
}

function DateField({ label, field, value, onChange, saving }: {
  label: string; field: string; value: string;
  onChange: (f: string, v: unknown) => void; saving: string | null
}) {
  return (
    <FieldShell label={label} saving={saving === field}>
      <input
        type="date"
        value={value ? value.slice(0, 10) : ''}
        onChange={e => onChange(field, e.target.value)}
        className={inputCls}
      />
    </FieldShell>
  )
}

function NumField({ label, field, value, onChange, saving, currency }: {
  label: string; field: string; value: number | string;
  onChange: (f: string, v: unknown) => void; saving: string | null; currency?: boolean
}) {
  return (
    <FieldShell label={label} saving={saving === field}>
      <div className="relative">
        {currency && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>}
        <input
          type="number"
          step="any"
          value={value === null || value === undefined ? '' : value}
          onChange={e => onChange(field, e.target.value === '' ? null : Number(e.target.value))}
          className={`${inputCls} ${currency ? 'pl-5' : ''}`}
        />
      </div>
    </FieldShell>
  )
}

function BoolField({ label, field, value, onChange, saving }: {
  label: string; field: string; value: boolean;
  onChange: (f: string, v: unknown) => void; saving: string | null
}) {
  return (
    <FieldShell label={label} saving={saving === field}>
      <div className="flex items-center gap-2 py-1.5">
        <input
          type="checkbox"
          checked={!!value}
          onChange={e => onChange(field, e.target.checked)}
          className="h-4 w-4 rounded border-border accent-primary"
        />
        <span className="text-xs text-muted-foreground">{value ? 'Yes' : 'No'}</span>
      </div>
    </FieldShell>
  )
}

function PersonField({ label, idField, textField, local, users, onChange, saving }: {
  label: string; idField: string; textField: string;
  local: ExtendedProject; users: User[];
  onChange: (f: string, v: unknown) => void; saving: string | null
}) {
  const idVal = (local[idField] as string | null) ?? ''
  const textVal = (local[textField] as string | null) ?? ''
  return (
    <FieldShell label={label} saving={saving === idField || saving === textField}>
      <div className="flex flex-col gap-1">
        <select
          value={idVal}
          onChange={e => onChange(idField, e.target.value || null)}
          className={inputCls}
        >
          <option value="">— none —</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>
              {[u.first_name, u.last_name].filter(Boolean).join(' ') || u.email}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="or type a name"
          value={textVal}
          onChange={e => onChange(textField, e.target.value)}
          className={`${inputCls} text-xs`}
        />
      </div>
    </FieldShell>
  )
}

function SubField({ label, idField, textField, local, subs, onChange, saving }: {
  label: string; idField: string; textField: string;
  local: ExtendedProject; subs: Subcontractor[];
  onChange: (f: string, v: unknown) => void; saving: string | null
}) {
  const idVal = (local[idField] as string | null) ?? ''
  const textVal = (local[textField] as string | null) ?? ''
  return (
    <FieldShell label={label} saving={saving === idField || saving === textField}>
      <div className="flex flex-col gap-1">
        <select
          value={idVal}
          onChange={e => onChange(idField, e.target.value || null)}
          className={inputCls}
        >
          <option value="">— none —</option>
          {subs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input
          type="text"
          placeholder="or type a name"
          value={textVal}
          onChange={e => onChange(textField, e.target.value)}
          className={`${inputCls} text-xs`}
        />
      </div>
    </FieldShell>
  )
}

function AgingBadge({ label, from, to }: { label: string; from: string | null | undefined; to: string | null | undefined }) {
  const days = (() => {
    if (!from) return null
    const start = new Date(from)
    const end = to ? new Date(to) : new Date()
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  })()
  return (
    <FieldShell label={label}>
      <div className="rounded-md border border-dashed border-border bg-muted/30 px-2.5 py-1.5 text-sm">
        {days == null ? <span className="text-muted-foreground">—</span> : (
          <span className={days > 60 ? 'font-bold text-red-600' : days > 30 ? 'font-semibold text-amber-600' : 'text-emerald-600'}>
            {days} {days === 1 ? 'day' : 'days'}
          </span>
        )}
      </div>
    </FieldShell>
  )
}
