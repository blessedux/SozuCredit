import { createClient } from "@/lib/supabase/server"
import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"

async function WelcomeContent({ userId }: { userId: string }) {
  const supabase = await createClient()
  
  const [profileResult, courseProgressResult, businessIdeaResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("course_progress").select("*").eq("user_id", userId),
    supabase.from("business_ideas").select("*").eq("user_id", userId).single(),
  ])

  const profile = profileResult.data
  const courseProgress = courseProgressResult.data || []
  const businessIdea = businessIdeaResult.data

  const totalLessons = 5
  const completedLessons = courseProgress.filter((p) => p.completed).length
  const courseCompleted = completedLessons === totalLessons

  return (
    <div className="mb-8">
      <h2 className="mb-2 text-3xl font-bold">Welcome back, {profile?.display_name || "User"}</h2>
      <p className="text-muted-foreground">
        {!courseCompleted
          ? "Complete the course to unlock funding opportunities"
          : !businessIdea
            ? "Submit your business idea to get started"
            : "Your journey to funding is underway"}
      </p>
    </div>
  )
}

function WelcomeSkeleton() {
  return (
    <div className="mb-8 space-y-2">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-5 w-96" />
    </div>
  )
}

export function WelcomeSection({ userId }: { userId: string }) {
  return (
    <Suspense fallback={<WelcomeSkeleton />}>
      <WelcomeContent userId={userId} />
    </Suspense>
  )
}
