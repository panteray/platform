import { ServiceShell } from '@/components/service/ServiceShell'
import ProblemsView from '@/components/service/ProblemsView'

export default function ServiceProblemsPage() {
  return (
    <ServiceShell activeTab="problems">
      <ProblemsView />
    </ServiceShell>
  )
}
