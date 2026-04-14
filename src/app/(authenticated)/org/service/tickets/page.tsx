import { ServiceShell } from '@/components/service/ServiceShell'
import TicketsView from '@/components/service/TicketsView'

export default function ServiceTicketsPage() {
  return (
    <ServiceShell activeTab="tickets">
      <TicketsView />
    </ServiceShell>
  )
}
