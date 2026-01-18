import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { StatsSection } from "./stats-section"
import { WelcomeSection } from "./welcome-section"
import { ActionsSection } from "./actions-section"
import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"

async function HeaderContent({ userId }: { userId: string }) {
  const supabase = await createClient()
  const profileResult = await supabase.from("profiles").select("*").eq("id", userId).single()
  const profile = profileResult.data

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <h1 className="text-xl font-semibold">Micro-Credit Platform</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{profile?.display_name || "User"}</span>
          <form action="/auth/signout" method="post">
            <Button variant="ghost" size="sm">
              Sign Out
            </Button>
          </form>
        </div>
      </div>
    </header>
  )
}

function HeaderSkeleton() {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Skeleton className="h-6 w-48" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
    </header>
  )
}

export default async function DashboardPage() {
  // In dev mode without Supabase, allow access (auth is checked via sessionStorage client-side)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const isDevMode = process.env.NODE_ENV === "development"
  
  let user = null
  let error = null
  let supabase = null
  
  // Only check Supabase if credentials are configured
  if (supabaseUrl && supabaseAnonKey) {
    try {
      supabase = await createClient()
      const authResult = await supabase.auth.getUser()
      user = authResult.data.user
      error = authResult.error
    } catch (e) {
      error = e as Error
    }
  }

  // In dev mode without Supabase, allow access (sessionStorage auth is checked client-side)
  if ((!supabaseUrl || !supabaseAnonKey) && isDevMode) {
    // Allow access - auth is validated via sessionStorage on client
    // Return a simplified version for dev mode
    return (
      <div className="min-h-screen bg-muted/30">
        <HeaderSkeleton />
        <main className="mx-auto max-w-7xl px-6 py-8">
          <p className="text-muted-foreground">Development mode: Supabase not configured</p>
        </main>
      </div>
    )
  } else if (error || !user) {
    redirect("/auth")
  }

  const userId = user!.id

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header with Suspense */}
      <Suspense fallback={<HeaderSkeleton />}>
        <HeaderContent userId={userId} />
      </Suspense>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Welcome Section with Suspense */}
        <WelcomeSection userId={userId} />

        {/* Stats Section with Suspense and parallel fetching */}
        <StatsSection userId={userId} />

        {/* Actions Section with Suspense */}
        <ActionsSection userId={userId} />
      </main>
    </div>
  )
}
