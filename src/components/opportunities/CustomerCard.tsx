'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { Customer, Opportunity } from '@/types/database'

interface Props { customerId: string }

export function CustomerCard({ customerId }: Props) {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [relatedOpps, setRelatedOpps] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [custRes, oppsRes] = await Promise.all([
        fetch('/api/org/customers'),
        fetch('/api/org/opportunities'),
      ])
      if (custRes.ok) {
        const customers: Customer[] = await custRes.json()
        setCustomer(customers.find((c) => c.id === customerId) ?? null)
      }
      if (oppsRes.ok) {
        const opps: Opportunity[] = await oppsRes.json()
        setRelatedOpps(opps.filter((o) => o.customer_id === customerId))
      }
      setLoading(false)
    }
    load()
  }, [customerId])

  if (loading) return <div className="rounded-lg border border-border bg-card p-4"><p className="text-sm text-muted-foreground">Loading customer...</p></div>
  if (!customer) return null

  return (
    <div className="rounded-lg border border-border bg-card p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">Customer</h2>
        <Link href={`/org/customers/${customer.id}`} className="text-xs text-primary hover:underline">View Full Record</Link>
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div><span className="text-[11px] text-muted-foreground block">Name</span><span className="text-foreground">{customer.name}</span></div>
        <div><span className="text-[11px] text-muted-foreground block">Type</span><span className="text-foreground">{customer.customer_type ?? '—'}</span></div>
        <div><span className="text-[11px] text-muted-foreground block">Contact</span><span className="text-foreground">{customer.contact_name ?? '—'}</span></div>
        <div><span className="text-[11px] text-muted-foreground block">Email</span><span className="text-foreground">{customer.contact_email ?? '—'}</span></div>
        <div><span className="text-[11px] text-muted-foreground block">Phone</span><span className="text-foreground">{customer.contact_phone ?? '—'}</span></div>
        <div><span className="text-[11px] text-muted-foreground block">State</span><span className="text-foreground">{customer.region_state ?? customer.state ?? '—'}</span></div>
      </div>
      {relatedOpps.length > 1 && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="text-[11px] font-medium text-muted-foreground mb-1">Related Opportunities ({relatedOpps.length})</p>
          <div className="flex flex-wrap gap-2">
            {relatedOpps.map((o) => (
              <Link key={o.id} href={`/org/opportunities/${o.id}`} className="text-xs text-primary hover:underline">
                {o.opp_number}{o.project_name ? ` — ${o.project_name}` : ''}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
