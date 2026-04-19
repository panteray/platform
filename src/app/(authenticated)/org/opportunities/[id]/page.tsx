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
import { DesignsTab } from '@/components/opportunities/DesignsTab'
import { CustomerCard } from '@/components/opportunities/CustomerCard'
import { BomTab } from '@/components/opportunities/BomTab'
import { HardwareScheduleTab } from '@/components/opportunities/HardwareScheduleTab'
import { SowTab } from '@/components/opportunities/SowTab'
import { CompileEngine } from '@/components/opportunities/CompileEngine'
import { VaultSection } from '@/components/opportunities/VaultSection'
import { OppStatusTimeline } from '@/components/opportunities/OppStatusTimeline'
import { OppApprovalGate } from '@/components/opportunities/OppApprovalGate'
import { SurveyModule } from '@/components/surveys/SurveyModule'
import { RfpQuoteTab } from '@/components/opportunities/RfpQuoteTab'
import { CustomerPortalTab } from '@/components/opportunities/CustomerPortalTab'
import { ProjectFromOppTab } from '@/components/projects/ProjectFromOppTab'

const TABS = ['Overview','Surveys','Designs','Hardware Schedule','SOW','BOM','Sub Quotes','Customer Portal','Project','Field','Risk Factors','Delivery','Huddle','Status History','Approvals'] as const
type Tab = (typeof TABS)[number]

export default function OppDetailPage() {
  const params = useParams<{ id: string }>()
  const { user } = useUser()
  const [opp, setOpp] = useState<Opportunity | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('Overview')
  const [showCompile, setShowCompile] = useState(false)
  const [callerRole, setCallerRole] = useState<string | null>(null)
  const [callerUserId, setCallerUserId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!params?.id) return
    const res = await fetch(`/api/org/opportunities/${params.id}`)
    if (!res.ok) { setLoading(false); return }
    const data = await res.json()
    setOpp(data)
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

      {/* Tabs — scrollable with fade indicators */}
      <div className="relative mb-3">
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-l from-background to-transparent" />
        <div className="flex gap-0 border-b border-border overflow-x-auto scrollbar-hide">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`border-b-2 px-3 py-2 text-[13px] font-medium transition-colors whitespace-nowrap ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{t}</button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="rounded-lg border border-border bg-card p-4">
        {tab === 'Overview' && <OverviewTab opp={opp} callerRole={callerRole} onUpdate={(updated) => setOpp(updated)} />}
        {tab === 'Delivery' && <DeliveryTab oppId={opp.id} />}
        {tab === 'Surveys' && <SurveyModule oppId={opp.id} oppNumber={opp.opp_number ?? undefined} />}
        {tab === 'Designs' && <DesignsTab oppId={opp.id} oppNumber={opp.opp_number ?? ''} projectName={opp.project_name ?? undefined} />}
        {tab === 'Hardware Schedule' && <HardwareScheduleTab oppId={opp.id} />}
        {tab === 'SOW' && <SowTab oppId={opp.id} opportunity={opp} />}
        {tab === 'BOM' && <BomTab oppId={opp.id} />}
        {tab === 'Sub Quotes' && <RfpQuoteTab oppId={opp.id} callerRole={callerRole} />}
        {tab === 'Customer Portal' && <CustomerPortalTab oppId={opp.id} />}
        {tab === 'Project' && <ProjectFromOppTab oppId={opp.id} opp={opp} />}
        {tab === 'Field' && <StubTab name="Field" />}
        {tab === 'Risk Factors' && <StubTab name="Risk Factors" />}
        {tab === 'Huddle' && <HuddleTab oppId={opp.id} callerRole={callerRole} callerUserId={callerUserId} />}
        {tab === 'Status History' && <OppStatusTimeline oppId={opp.id} />}
        {tab === 'Approvals' && <OppApprovalGate oppId={opp.id} callerRole={callerRole} />}
      </div>

      {/* Compile Package button */}
      <div className="mt-4 flex justify-end">
        <button onClick={() => setShowCompile(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
          Compile Document Package
        </button>
      </div>

      {/* Vault + Customer Card */}
      <VaultSection oppId={opp.id} />
      {opp.customer_id && <CustomerCard customerId={opp.customer_id} />}

      {/* Compile Engine Modal */}
      {showCompile && <CompileEngine oppId={opp.id} onClose={() => setShowCompile(false)} />}
    </div>
  )
}
