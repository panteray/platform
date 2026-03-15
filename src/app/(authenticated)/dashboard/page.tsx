import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: dbUser } = await supabase
    .from('users')
    .select('role, is_global_admin, org_id')
    .eq('auth_id', user.id)
    .single()

  // Global admins → admin portal
  if (dbUser && ['GLOBAL_ADMIN', 'GLOBAL_MANAGER'].includes(dbUser.role)) {
    redirect('/admin')
  }

  // Org users → org dashboard
  if (dbUser?.org_id) {
    redirect('/org')
  }

  return (
    <div>
      <h1 className="text-lg font-medium">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        No organization assigned. Contact your administrator.
      </p>
    </div>
  )
}
