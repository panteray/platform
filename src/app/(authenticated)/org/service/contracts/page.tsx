import { ServiceShell } from '@/components/service/ServiceShell'
import ServiceContractsView from '@/components/service/ServiceContractsView'

export default function ServiceContractsPage() {
  return (
    <ServiceShell activeTab="contracts">
      <ServiceContractsView />
    </ServiceShell>
  )
}
