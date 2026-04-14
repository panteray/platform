import { ServiceShell } from '@/components/service/ServiceShell'
import ContractsDocsView from '@/components/service/ContractsDocsView'

export default function ServiceDocsPage() {
  return (
    <ServiceShell activeTab="docs">
      <ContractsDocsView />
    </ServiceShell>
  )
}
