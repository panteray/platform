'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { Opportunity } from '@/types/database'
import { OPP_STATUS_LABELS } from '@/types/enums'
import { useUser } from '@/hooks/useUser'
import { OverviewTab } from '@/components/opportunities/OverviewTab'
import { DeliveryTab } from '@/components/opportunities/DeliveryTab'
import { StubTab } from '@/components/opportunities/StubTab'
import { HuddleTab } from '@/components/opportunities/HuddleTab'
import { CustomerCard } from '@/components/opportunities/CustomerCard'

const TABS = ['Overview','Surveys','Designs','Door Compliance','Hardware Schedule','SOW','BOM','Project','Field','Risk Factors','Delivery','Huddle'] as const
type Tab = (typeof TABS)[number]

export default function OppDetailPage() {
  const params = useParams<{ id: string }>()
  const { user } = useUser()
  const [opp, setOpp] = useState<Opportunity | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('Overview')
  const [callerRole, setCallerRole] = useState<string | null>(null)
  const [callerUserId, setCallerUserId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!params?.id) return
    const res = await fetch('/api/org/opportunities')
    if (!res.ok) { setLoading(false); return }
    const opps: Opportunity[] = await res.json()
    setOpp(opps.find((o) => o.id === params.id) ?? null)
    setLoading(false)
  }, [params?.id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!user) return
    fetch('/api/org/users').then(async (r) => {
      if (!r.ok) return
      const users = await r.json()
      const me = users.find((u: { auth_id: string }) => u.auth_id === user.id)
      if (me) { setCallerRole(me.role); setCallerUserId(me.id) }
    })
  }, [user])

  if (loading) return <div className="flex h-64 items-center justify-center"><p className="text-sm text-muted-foreground">Loading opportunity...</p></div>
  if (!opp) return <div className="flex h-64 flex-col items-center justify-center gap-2"><p className="text-sm text-muted-foreground">Opportunity not found.</p><Link href="/org/opportunities" className="text-sm text-primary hover:underline">Back to opportunities</Link></div>

  return (
    <div>
      {/* Header */}
      <div className="mb-3 flex items-center gap-2.5 flex-wrap">
        <Link href="/org/opportunities" className="rounded p-1.5 hover:bg-muted"><ArrowLeft className="h-4 w-4 text-muted-foreground" /></Link>
        <span className="text-[13px] text-muted-foreground">Opportunities</span><span className="text-muted-foreground">/</span>
        <span className="text-base font-semibold text-foreground">{opp.opp_number}</span>
        {opp.opp_type && <span className="text-[11px] font-semibold px-2 py-0.5 rounded border border-border">{opp.opp_type}</span>}
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">{(OPP_STATUS_LABELS[opp.status as keyof typeof OPP_STATUS_LABELS] ?? opp.status).replace(/_/g, ' ')}</span>
        {opp.project_name && <span className="text-sm text-muted-foreground">— {opp.project_name}</span>}
      </div>

      {/* Tabs */}
      <div className="mb-3 flex gap-0 border-b border-border overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`border-b-2 px-3 py-2 text-[13px] font-medium transition-colors whitespace-nowrap ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{t}</button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="rounded-lg border border-border bg-card p-4">
        {tab === 'Overview' && <OverviewTab opp={opp} callerRole={callerRole} onUpdate={(updated) => setOpp(updated)} />}
        {tab === 'Delivery' && <DeliveryTab oppId={opp.id} />}
        {tab === 'Surveys' && <StubTab name="Surveys" />}
        {tab === 'Designs' && <StubTab name="Designs" />}
        {tab === 'Door Compliance' && <StubTab name="Door Compliance" />}
        {tab === 'Hardware Schedule' && <StubTab name="Hardware Schedule" />}
        {tab === 'SOW' && <StubTab name="SOW" />}
        {tab === 'BOM' && <StubTab name="BOM" />}
        {tab === 'Project' && <StubTab name="Project" />}
        {tab === 'Field' && <StubTab name="Field" />}
        {tab === 'Risk Factors' && <StubTab name="Risk Factors" />}
        {tab === 'Huddle' && <HuddleTab oppId={opp.id} callerRole={callerRole} callerUserId={callerUserId} />}
      </div>

      {/* Customer Card */}
      {opp.customer_id && <CustomerCard customerId={opp.customer_id} />}
    </div>
  )
}
