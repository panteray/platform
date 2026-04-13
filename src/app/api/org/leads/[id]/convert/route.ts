import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyLeadCrud } from '@/lib/auth'

/**
 * Lead Conversion — 5-step workflow:
 * 1. Duplicate check (fuzzy company_name + exact contact_email against customers)
 * 2. Customer record creation from lead fields
 * 3. Contact record creation (entity_type = 'customer')
 * 4. Optional opportunity creation (if createOpp=true + opp_type provided)
 * 5. Lead finalized: status=CONVERTED, converted_customer_id/opp_id/at/by populated
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await verifyLeadCrud()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: leadId } = await params
  const body = await request.json()
  const { createOpp, oppType, skipDuplicateCheck } = body as {
    createOpp?: boolean
    oppType?: string
    skipDuplicateCheck?: boolean
  }

  const admin = createAdminClient()

  // Fetch lead
  const { data: lead, error: leadErr } = await admin
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .eq('org_id', caller.org_id)
    .single()

  if (leadErr || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  if (lead.status === 'CONVERTED') {
    return NextResponse.json({ error: 'Lead is already converted' }, { status: 400 })
  }

  if (lead.status !== 'QUALIFIED') {
    return NextResponse.json(
      { error: 'Lead must be in QUALIFIED status to convert' },
      { status: 400 }
    )
  }

  // Step 1: Duplicate check
  if (!skipDuplicateCheck) {
    const duplicates: string[] = []

    if (lead.contact_email) {
      const { data: emailMatch } = await admin
        .from('customers')
        .select('id, name, contact_email')
        .eq('org_id', caller.org_id)
        .eq('contact_email', lead.contact_email)
        .limit(3)
      if (emailMatch && emailMatch.length > 0) {
        duplicates.push(...emailMatch.map((c) => `${c.name} (${c.contact_email})`))
      }
    }

    if (lead.company_name) {
      const { data: nameMatch } = await admin
        .from('customers')
        .select('id, name')
        .eq('org_id', caller.org_id)
        .ilike('name', `%${lead.company_name}%`)
        .limit(3)
      if (nameMatch && nameMatch.length > 0) {
        const existing = duplicates.length
        nameMatch.forEach((c) => {
          const label = c.name
          if (!duplicates.includes(label)) duplicates.push(label)
        })
        // Only flag if we found new matches beyond email
        if (duplicates.length > existing) { /* has name matches */ }
      }
    }

    if (duplicates.length > 0) {
      return NextResponse.json({
        warning: 'potential_duplicates',
        duplicates,
        message: 'Potential duplicate customers found. Set skipDuplicateCheck=true to proceed.',
      }, { status: 409 })
    }
  }

  // Step 2: Create customer
  // Generate next customer number
  const { data: lastCust } = await admin
    .from('customers')
    .select('customer_number')
    .eq('org_id', caller.org_id)
    .order('customer_number', { ascending: false })
    .limit(1)
  const lastNum = lastCust?.[0]?.customer_number
  const nextNum = lastNum ? parseInt(lastNum.replace('CU-', ''), 10) + 1 : 1
  const customerNumber = `CU-${String(nextNum).padStart(6, '0')}`

  const { data: customer, error: custErr } = await admin.from('customers').insert({
    org_id: caller.org_id,
    customer_number: customerNumber,
    name: lead.company_name || `${lead.contact_first_name} ${lead.contact_last_name}`,
    customer_type: lead.vertical ?? null,
    contact_name: `${lead.contact_first_name} ${lead.contact_last_name}`,
    contact_email: lead.contact_email ?? null,
    contact_phone: lead.contact_phone ?? null,
    address: lead.address ?? null,
    state: lead.state ?? null,
    primary_website: lead.primary_website ?? null,
    notes: lead.notes ?? null,
    created_by: caller.id,
  }).select().single()

  if (custErr) {
    return NextResponse.json({ error: `Customer creation failed: ${custErr.message}` }, { status: 400 })
  }

  // Step 3: Create contact record
  await admin.from('contacts').insert({
    org_id: caller.org_id,
    entity_type: 'customer',
    entity_id: customer.id,
    first_name: lead.contact_first_name,
    last_name: lead.contact_last_name,
    title: lead.contact_title ?? null,
    email: lead.contact_email ?? null,
    phone: lead.contact_phone ?? null,
    mobile: lead.contact_mobile ?? null,
    created_by: caller.id,
  }).select().single()
  // Contact creation failure is non-blocking

  // Step 4: Optional opportunity creation
  let oppId: string | null = null
  if (createOpp && oppType) {
    // Generate next opp number
    const { data: lastOpp } = await admin
      .from('opportunities')
      .select('opp_number')
      .eq('org_id', caller.org_id)
      .order('opp_number', { ascending: false })
      .limit(1)
    const lastOppNum = lastOpp?.[0]?.opp_number
    const nextOppNum = lastOppNum ? parseInt(lastOppNum.replace('OP-', ''), 10) + 1 : 1
    const oppNumber = `OP-${String(nextOppNum).padStart(6, '0')}`

    const { data: opp } = await admin.from('opportunities').insert({
      org_id: caller.org_id,
      opp_number: oppNumber,
      customer_id: customer.id,
      opp_type: oppType,
      status: 'NEW',
      name: lead.company_name
        ? `${lead.company_name} — ${oppType}`
        : `${lead.contact_first_name} ${lead.contact_last_name} — ${oppType}`,
      estimated_value: lead.estimated_value ?? null,
      state: lead.state ?? null,
      created_by: caller.id,
    }).select().single()

    if (opp) oppId = opp.id
  }

  // Step 5: Finalize lead
  const { data: converted, error: convertErr } = await admin.from('leads')
    .update({
      status: 'CONVERTED',
      converted_customer_id: customer.id,
      converted_opp_id: oppId,
      converted_at: new Date().toISOString(),
      converted_by: caller.id,
    })
    .eq('id', leadId)
    .select()
    .single()

  if (convertErr) {
    return NextResponse.json({ error: `Lead finalization failed: ${convertErr.message}` }, { status: 400 })
  }

  await admin.from('audit_log').insert({
    org_id: caller.org_id,
    user_id: caller.id,
    action: 'lead.converted',
    entity_type: 'lead',
    entity_id: leadId,
    details: {
      customer_id: customer.id,
      customer_number: customerNumber,
      opp_id: oppId,
    },
  })

  return NextResponse.json({
    lead: converted,
    customer,
    opp_id: oppId,
  })
}
