import { ServiceShell } from '@/components/service/ServiceShell'
import RmrView from '@/components/service/RmrView'

export default function ServiceRmrPage() {
  return (
    <ServiceShell activeTab="rmr">
      <RmrView />
    </ServiceShell>
  )
}
