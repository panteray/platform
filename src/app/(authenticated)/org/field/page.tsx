// /org/field — My Day dashboard for field technicians.
// Shows tickets assigned to the current user, grouped by today / upcoming / active.
// Separate from /org/field-ops (which is the PM-facing project list).

import { MyDaySchedule } from '@/components/field-ops/MyDaySchedule'

export default function MyDayPage() {
  return (
    <div className="max-w-3xl mx-auto p-5 pb-24">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">My Day</h1>
        <p className="text-sm text-neutral-500 mt-1">Your tickets, schedule, and active work.</p>
      </div>
      <MyDaySchedule />
    </div>
  )
}
