'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { FileText, Ticket, Receipt, PlusCircle, AlertCircle } from 'lucide-react'

interface Account {
  customer: { id: string; name: string; contact_name: string | null; contact_email: string | null; contact_phone: string | null; address: string | null; state: string | null }
  permissions: string[]
  expires_at: string
}
interface Invoice { id: string; invoice_number: string; total: number; balance_due: number; status: string; due_date: string | null; issued_at: string | null }
interface TicketItem { id: string; ticket_number?: string; title?: string; subject?: string; status: string; priority?: string; created_at: string; type?: string }

export default function CustomerAccountPortalPage() {
  const params = useParams<{ token: string }>()
  const token = params?.token
  const [account, setAccount] = useState<Account | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [tickets, setTickets] = useState<TicketItem[]>([])
  const [requests, setRequests] = useState<TicketItem[]>([])
  const [tab, setTab] = useState<'overview' | 'invoices' | 'tickets'>('overview')
  const [error, setError] = useState<string | null>(null)
  const [showNewRequest, setShowNewRequest] = useState(false)
  const [form, setForm] = useState({ type: 'TICKET', subject: '', body: '', priority: 'P3', created_by_name: '', created_by_email: '' })

  useEffect(() => {
    if (!token) return
    ;(async () => {
      const res = await fetch(`/api/portal/customer/${token}`)
      if (!res.ok) { setError((await res.json()).error); return }
      setAccount(await res.json())
      const [invRes, tkRes] = await Promise.all([
        fetch(`/api/portal/customer/${token}/invoices`),
        fetch(`/api/portal/customer/${token}/tickets`),
      ])
      if (invRes.ok) setInvoices(await invRes.json())
      if (tkRes.ok) {
        const data = await tkRes.json()
        setTickets(data.tickets ?? [])
        setRequests(data.requests ?? [])
      }
    })()
  }, [token])

  async function submitRequest() {
    if (!form.subject || !form.body || !form.created_by_name) return
    const res = await fetch(`/api/portal/customer/${token}/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      setShowNewRequest(false)
      setForm({ type: 'TICKET', subject: '', body: '', priority: 'P3', created_by_name: '', created_by_email: '' })
      const tkRes = await fetch(`/api/portal/customer/${token}/tickets`)
      if (tkRes.ok) {
        const data = await tkRes.json()
        setTickets(data.tickets ?? [])
        setRequests(data.requests ?? [])
      }
    }
  }

  if (error) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md rounded-lg bg-white p-8 shadow text-center">
        <AlertCircle className="mx-auto mb-3 text-red-500" size={40} />
        <div className="text-slate-900 font-semibold">{error}</div>
      </div>
    </div>
  )
  if (!account) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Loading...</div>

  const totalDue = invoices.reduce((a, i) => a + (i.balance_due || 0), 0)
  const openTickets = tickets.filter((t) => !['CLOSED', 'RESOLVED', 'CANCELLED'].includes(t.status)).length

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <div className="text-xs uppercase tracking-widest text-slate-400">Customer Portal</div>
          <div className="mt-1 text-2xl font-bold">{account.customer.name}</div>
          <div className="mt-1 text-sm text-slate-300">{account.customer.contact_name ?? ''} · {account.customer.contact_email ?? ''}</div>
        </div>
      </header>

      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 flex gap-1">
          {(['overview', 'invoices', 'tickets'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium capitalize ${tab === t ? 'border-b-2 border-slate-900 text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-6 py-6">
        {tab === 'overview' && (
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <Receipt className="text-slate-400" />
                <div className="text-xs uppercase text-slate-500">Balance Due</div>
              </div>
              <div className="mt-2 text-3xl font-bold text-slate-900">${totalDue.toFixed(2)}</div>
              <div className="text-xs text-slate-500">{invoices.length} open invoice{invoices.length !== 1 ? 's' : ''}</div>
            </div>
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <Ticket className="text-slate-400" />
                <div className="text-xs uppercase text-slate-500">Open Tickets</div>
              </div>
              <div className="mt-2 text-3xl font-bold text-slate-900">{openTickets}</div>
              <div className="text-xs text-slate-500">{requests.length} pending request{requests.length !== 1 ? 's' : ''}</div>
            </div>
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <FileText className="text-slate-400" />
                <div className="text-xs uppercase text-slate-500">Account</div>
              </div>
              <div className="mt-2 text-sm text-slate-700">{account.customer.address ?? '—'}</div>
              <div className="text-sm text-slate-500">{account.customer.state ?? ''}</div>
            </div>
          </div>
        )}

        {tab === 'invoices' && (
          <div className="rounded-lg bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Invoice #</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Issued</th>
                  <th className="px-4 py-3 text-left">Due</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-mono text-xs">{i.invoice_number}</td>
                    <td className="px-4 py-3">{i.status}</td>
                    <td className="px-4 py-3">{i.issued_at ? new Date(i.issued_at).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3">{i.due_date ? new Date(i.due_date).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3 text-right">${(i.total || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-semibold">${(i.balance_due || 0).toFixed(2)}</td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">No invoices</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'tickets' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => setShowNewRequest(!showNewRequest)} className="flex items-center gap-2 rounded bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800">
                <PlusCircle size={16} /> New Request
              </button>
            </div>

            {showNewRequest && (
              <div className="rounded-lg bg-white p-4 shadow-sm space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="rounded border border-slate-300 px-3 py-2 text-sm">
                    <option value="TICKET">Service Ticket</option>
                    <option value="QUOTE">Quote Request</option>
                    <option value="GENERAL">General Inquiry</option>
                  </select>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="rounded border border-slate-300 px-3 py-2 text-sm">
                    <option value="P1">P1 Critical</option>
                    <option value="P2">P2 High</option>
                    <option value="P3">P3 Medium</option>
                    <option value="P4">P4 Low</option>
                  </select>
                  <input placeholder="Your name" value={form.created_by_name} onChange={(e) => setForm({ ...form, created_by_name: e.target.value })} className="rounded border border-slate-300 px-3 py-2 text-sm" />
                  <input placeholder="Your email" value={form.created_by_email} onChange={(e) => setForm({ ...form, created_by_email: e.target.value })} className="rounded border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <input placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
                <textarea placeholder="Describe the issue or request..." value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={4} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
                <button onClick={submitRequest} className="rounded bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800">Submit</button>
              </div>
            )}

            <div className="rounded-lg bg-white shadow-sm">
              <div className="border-b border-slate-200 px-4 py-2 text-xs font-semibold uppercase text-slate-600">Active Tickets</div>
              {tickets.length === 0 && <div className="px-4 py-6 text-center text-slate-500 text-sm">No tickets</div>}
              {tickets.map((t) => (
                <div key={t.id} className="border-b border-slate-100 px-4 py-3">
                  <div className="flex justify-between">
                    <div className="text-sm font-medium text-slate-900">{t.title ?? t.subject}</div>
                    <div className="text-xs text-slate-500">{t.status}</div>
                  </div>
                  <div className="text-xs text-slate-500">{new Date(t.created_at).toLocaleDateString()}</div>
                </div>
              ))}
            </div>

            {requests.length > 0 && (
              <div className="rounded-lg bg-white shadow-sm">
                <div className="border-b border-slate-200 px-4 py-2 text-xs font-semibold uppercase text-slate-600">Submitted Requests</div>
                {requests.map((r) => (
                  <div key={r.id} className="border-b border-slate-100 px-4 py-3">
                    <div className="flex justify-between">
                      <div className="text-sm font-medium text-slate-900">{r.subject}</div>
                      <div className="text-xs text-slate-500">{r.status}</div>
                    </div>
                    <div className="text-xs text-slate-500">{r.type} · {new Date(r.created_at).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
