import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-neutral-950 p-8">
      <h1 className="text-2xl font-bold text-white">Dashboard</h1>
      <p className="text-neutral-400 mt-2">
        Signed in as {user?.email}
      </p>
    </div>
  )
}
