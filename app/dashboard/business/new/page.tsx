import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { BusinessForm } from "./business-form"

export default async function NewBusinessPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    redirect("/auth")
  }

  // Check if course is completed
  const { data: courseProgress } = await supabase.from("course_progress").select("*").eq("user_id", user.id)

  const totalLessons = 5
  const completedLessons = courseProgress?.filter((p) => p.completed).length || 0
  const courseCompleted = completedLessons === totalLessons

  if (!courseCompleted) {
    redirect("/dashboard/course")
  }

  // Check if business idea already exists
  const { data: existingBusiness } = await supabase.from("business_ideas").select("*").eq("user_id", user.id).single()

  if (existingBusiness) {
    redirect("/dashboard/business")
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard">← Back</Link>
            </Button>
            <h1 className="text-xl font-semibold">Submit Business Idea</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Tell us about your business</CardTitle>
            <CardDescription>
              Provide details about your business idea to get community support and funding
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BusinessForm userId={user.id} />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
