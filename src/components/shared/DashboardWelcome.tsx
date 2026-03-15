'use client'

interface DashboardWelcomeProps {
  title: string
  subtitle: string
  firstName?: string | null
}

export function DashboardWelcome({
  title,
  subtitle,
  firstName,
}: DashboardWelcomeProps) {
  const showWelcome = firstName != null && String(firstName).trim() !== ''

  return (
    <div>
      {showWelcome ? (
        <>
          <h1 className="text-2xl font-semibold text-foreground">
            Welcome back, {firstName}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        </>
      )}
    </div>
  )
}
