'use client'

import {
  CONTRACT_BILLING_MODELS,
  CONTRACT_BILLING_CYCLES,
  type ContractBillingModel,
  type ContractBillingCycle,
  type BlockTimeRollover,
} from '@/types/database'

export type ContractFormState = {
  name: string
  customer_id: string
  billing_model: ContractBillingModel
  billing_cycle: ContractBillingCycle
  start_date: string
  end_date: string
  auto_renew: boolean
  renewal_notice_days: number
  annual_escalation_pct: number
  block_hours_total: string
  block_rollover_type: BlockTimeRollover
  block_rollover_cap: string
  overage_rate: string
  notes: string
}

export const EMPTY_CONTRACT_FORM: ContractFormState = {
  name: '',
  customer_id: '',
  billing_model: 'PER_DEVICE',
  billing_cycle: 'MONTHLY',
  start_date: new Date().toISOString().slice(0, 10),
  end_date: '',
  auto_renew: true,
  renewal_notice_days: 30,
  annual_escalation_pct: 0,
  block_hours_total: '',
  block_rollover_type: 'NONE',
  block_rollover_cap: '',
  overage_rate: '',
  notes: '',
}

export function ContractBillingModelForm({
  state,
  onChange,
  customers,
}: {
  state: ContractFormState
  onChange: (next: ContractFormState) => void
  customers: Array<{ id: string; name: string }>
}) {
  const set = <K extends keyof ContractFormState>(key: K, val: ContractFormState[K]) =>
    onChange({ ...state, [key]: val })

  const isBlockTime = state.billing_model === 'BLOCK_TIME'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Contract Name *</label>
          <input
            value={state.name}
            onChange={e => set('name', e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="Annual Maintenance Agreement"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Customer *</label>
          <select
            value={state.customer_id}
            onChange={e => set('customer_id', e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Select customer…</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Billing Model *</label>
          <select
            value={state.billing_model}
            onChange={e => set('billing_model', e.target.value as ContractBillingModel)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            {CONTRACT_BILLING_MODELS.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Billing Cycle *</label>
          <select
            value={state.billing_cycle}
            onChange={e => set('billing_cycle', e.target.value as ContractBillingCycle)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            {CONTRACT_BILLING_CYCLES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Start Date *</label>
          <input
            type="date"
            value={state.start_date}
            onChange={e => set('start_date', e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">End Date</label>
          <input
            type="date"
            value={state.end_date}
            onChange={e => set('end_date', e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="flex items-center gap-2 pt-5">
          <input
            type="checkbox"
            id="auto_renew"
            checked={state.auto_renew}
            onChange={e => set('auto_renew', e.target.checked)}
            className="h-4 w-4"
          />
          <label htmlFor="auto_renew" className="text-sm">Auto-renew</label>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Notice Days</label>
          <input
            type="number"
            value={state.renewal_notice_days}
            onChange={e => set('renewal_notice_days', Number(e.target.value) || 0)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Escalation %/yr</label>
          <input
            type="number"
            step="0.01"
            value={state.annual_escalation_pct}
            onChange={e => set('annual_escalation_pct', Number(e.target.value) || 0)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      {isBlockTime && (
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Block Time Settings</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs">Total Hours</label>
              <input
                type="number"
                step="0.5"
                value={state.block_hours_total}
                onChange={e => set('block_hours_total', e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs">Overage Rate $/hr</label>
              <input
                type="number"
                step="0.01"
                value={state.overage_rate}
                onChange={e => set('overage_rate', e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs">Rollover</label>
              <select
                value={state.block_rollover_type}
                onChange={e => set('block_rollover_type', e.target.value as BlockTimeRollover)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="NONE">None (forfeit)</option>
                <option value="FULL">Full rollover</option>
                <option value="CAPPED">Capped rollover</option>
              </select>
            </div>
            {state.block_rollover_type === 'CAPPED' && (
              <div>
                <label className="mb-1 block text-xs">Cap (hours)</label>
                <input
                  type="number"
                  step="0.5"
                  value={state.block_rollover_cap}
                  onChange={e => set('block_rollover_cap', e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            )}
          </div>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</label>
        <textarea
          value={state.notes}
          onChange={e => set('notes', e.target.value)}
          rows={3}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
    </div>
  )
}
