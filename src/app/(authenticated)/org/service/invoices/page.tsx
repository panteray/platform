import { ServiceShell } from '@/components/service/ServiceShell'
import InvoicesView from '@/components/service/InvoicesView'

export default function ServiceInvoicesPage() {
  return (
    <ServiceShell activeTab="invoices">
      <InvoicesView />
    </ServiceShell>
  )
}
