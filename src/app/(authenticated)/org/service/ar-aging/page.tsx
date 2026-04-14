import { ServiceShell } from '@/components/service/ServiceShell'
import ArAgingView from '@/components/service/ArAgingView'

export default function ServiceArAgingPage() {
  return (
    <ServiceShell activeTab="ar-aging">
      <ArAgingView />
    </ServiceShell>
  )
}
