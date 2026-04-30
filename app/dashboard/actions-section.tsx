import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"

async function ActionsContent({ userId }: { userId: string }) {
  const supabase = await createClient()
  
  const [courseProgressResult, businessIdeaResult, vaultResult] = await Promise.all([
    supabase.from("course_progress").select("*").eq("user_id", userId),
    supabase.from("business_ideas").select("*").eq("user_id", userId).single(),
    supabase.from("vaults").select("*").eq("user_id", userId).single(),
  ])

  const courseProgress = courseProgressResult.data || []
  const businessIdea = businessIdeaResult.data
  const vault = vaultResult.data

  const totalLessons = 5
  const completedLessons = courseProgress.filter((p) => p.completed).length
  const courseCompleted = completedLessons === totalLessons

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Course Card */}
      <Card>
        <CardHeader>
          <CardTitle>Financial Literacy Course</CardTitle>
          <CardDescription>Complete all lessons to qualify for funding</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{Math.round((completedLessons / totalLessons) * 100)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${(completedLessons / totalLessons) * 100}%` }}
              />
            </div>
          </div>
          <Button asChild className="w-full" disabled={courseCompleted}>
            <Link href="/dashboard/course">{courseCompleted ? "Course Completed" : "Continue Learning"}</Link>
          </Button>
        </CardContent>
      </Card>

      {/* Business Idea Card */}
      <Card>
        <CardHeader>
          <CardTitle>Your Business Idea</CardTitle>
          <CardDescription>
            {businessIdea ? "Manage your business proposal" : "Submit your business idea"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {businessIdea ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold">{businessIdea.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">{businessIdea.description}</p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Goal: ${businessIdea.funding_goal}</span>
                <Button asChild variant="outline" size="sm">
                  <Link href="/dashboard/business">View Details</Link>
                </Button>
              </div>
            </div>
          ) : (
            <Button asChild className="w-full" disabled={!courseCompleted}>
              <Link href="/dashboard/business/new">
                {courseCompleted ? "Submit Business Idea" : "Complete Course First"}
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Vault Card */}
      <Card>
        <CardHeader>
          <CardTitle>Your Vault</CardTitle>
          <CardDescription>Manage funds and earn {vault?.yield_rate || 15}% yield</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/dashboard/vault">Manage Vault</Link>
          </Button>
        </CardContent>
      </Card>

      {/* Community Card */}
      <Card>
        <CardHeader>
          <CardTitle>Community</CardTitle>
          <CardDescription>Vouch for other businesses and build trust</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Button asChild className="w-full">
              <Link href="/dashboard/community">Explore Businesses</Link>
            </Button>
            <Button asChild variant="outline" className="w-full bg-transparent">
              <Link href="/dashboard/community/search">Search by User</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Urban Treasure (City) Card */}
      <Card>
        <CardHeader>
          <CardTitle>Urban Treasure</CardTitle>
          <CardDescription>Find and redeem treasures at spots in your city</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/city">Open City Map</Link>
          </Button>
        </CardContent>
      </Card>

      {/* Expense Tracker Card */}
      <Card>
        <CardHeader>
          <CardTitle>Expense Tracker</CardTitle>
          <CardDescription>Track spending, scan receipts, and see reports</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/tracker">Open Tracker</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function ActionsSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function ActionsSection({ userId }: { userId: string }) {
  return (
    <Suspense fallback={<ActionsSkeleton />}>
      <ActionsContent userId={userId} />
    </Suspense>
  )
}
