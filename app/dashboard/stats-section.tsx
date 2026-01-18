import { createClient } from "@/lib/supabase/server"
import { Card, CardContent } from "@/components/ui/card"
import { Users, TrendingUp, BookOpen, Briefcase } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"

async function StatsCards({ userId }: { userId: string }) {
  const supabase = await createClient()
  
  // Parallel data fetching
  const [trustPointsResult, vaultResult, courseProgressResult, businessIdeaResult] = await Promise.all([
    supabase.from("trust_points").select("*").eq("user_id", userId).single(),
    supabase.from("vaults").select("*").eq("user_id", userId).single(),
    supabase.from("course_progress").select("*").eq("user_id", userId),
    supabase.from("business_ideas").select("*").eq("user_id", userId).single(),
  ])

  const trustPoints = trustPointsResult.data
  const vault = vaultResult.data
  const courseProgress = courseProgressResult.data || []
  const businessIdea = businessIdeaResult.data

  const totalLessons = 5
  const completedLessons = courseProgress.filter((p) => p.completed).length

  return (
    <div className="mb-8 grid gap-4 md:grid-cols-4">
      <Link href="/dashboard/trust-points">
        <Card className="transition-colors hover:bg-accent">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Trust Points</p>
                <p className="text-2xl font-bold">{trustPoints?.balance || 0}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </Link>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Vault Balance</p>
              <p className="text-2xl font-bold">${vault?.balance || 0}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Course Progress</p>
              <p className="text-2xl font-bold">
                {completedLessons}/{totalLessons}
              </p>
            </div>
            <BookOpen className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="text-2xl font-bold capitalize">{businessIdea?.status || "New"}</p>
            </div>
            <Briefcase className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StatsSkeleton() {
  return (
    <div className="mb-8 grid gap-4 md:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
              </div>
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function StatsSection({ userId }: { userId: string }) {
  return (
    <Suspense fallback={<StatsSkeleton />}>
      <StatsCards userId={userId} />
    </Suspense>
  )
}
