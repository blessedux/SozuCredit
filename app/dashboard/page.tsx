import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BookOpen, Briefcase, TrendingUp, Users } from "lucide-react"
import Link from "next/link"

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
  } else if (error || !user) {
    redirect("/auth")
  }

  // Get user profile (only if Supabase is configured)
  const profile = supabase 
    ? await supabase.from("profiles").select("*").eq("id", user!.id).single().then(r => r.data)
    : null

  // Get course progress (only if Supabase is configured)
  const courseProgress = supabase 
    ? await supabase.from("course_progress").select("*").eq("user_id", user!.id).then(r => r.data)
    : []

  const totalLessons = 5
  const completedLessons = courseProgress?.filter((p) => p.completed).length || 0
  const courseCompleted = completedLessons === totalLessons

  // Get business idea (only if Supabase is configured)
  const businessIdea = supabase
    ? await supabase.from("business_ideas").select("*").eq("user_id", user!.id).single().then(r => r.data)
    : null

  // Get trust points (only if Supabase is configured)
  const trustPoints = supabase
    ? await supabase.from("trust_points").select("*").eq("user_id", user!.id).single().then(r => r.data)
    : null

  // Get vault (only if Supabase is configured)
  const vault = supabase
    ? await supabase.from("vaults").select("*").eq("user_id", user!.id).single().then(r => r.data)
    : null

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-semibold">Micro-Credit Platform</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{profile?.display_name}</span>
            <form action="/auth/signout" method="post">
              <Button variant="ghost" size="sm">
                Sign Out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="mb-2 text-3xl font-bold">Welcome back, {profile?.display_name}</h2>
          <p className="text-muted-foreground">
            {!courseCompleted
              ? "Complete the course to unlock funding opportunities"
              : !businessIdea
                ? "Submit your business idea to get started"
                : "Your journey to funding is underway"}
          </p>
        </div>

        {/* Quick Stats */}
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

        {/* Main Actions */}
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
        </div>
      </main>
    </div>
  )
}
