import { ServiceShell } from '@/components/service/ServiceShell'
import WipReportView from '@/components/service/WipReportView'

export default function ServiceWipPage() {
  return (
    <ServiceShell activeTab="wip">
      <WipReportView />
    </ServiceShell>
  )
}
