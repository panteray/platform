import { ServiceShell } from '@/components/service/ServiceShell'
import DispatchView from '@/components/service/DispatchView'

export default function ServiceDispatchPage() {
  return (
    <ServiceShell activeTab="dispatch">
      <DispatchView />
    </ServiceShell>
  )
}
