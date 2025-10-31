import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Circle } from "lucide-react"
import Link from "next/link"

const lessons = [
  {
    id: 1,
    title: "Introduction to Micro-Credit",
    description: "Learn the basics of micro-credit and how it can help your business",
    duration: "5 min",
  },
  {
    id: 2,
    title: "Financial Responsibility",
    description: "Understanding loan repayment and financial planning",
    duration: "8 min",
  },
  {
    id: 3,
    title: "Business Planning Basics",
    description: "How to create a solid business plan",
    duration: "10 min",
  },
  {
    id: 4,
    title: "Community & Trust",
    description: "The importance of community support in micro-credit",
    duration: "6 min",
  },
  {
    id: 5,
    title: "Managing Your Funds",
    description: "Best practices for managing your micro-credit funds",
    duration: "7 min",
  },
]

export default async function CoursePage() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    redirect("/auth")
  }

  // Get course progress
  const { data: courseProgress } = await supabase.from("course_progress").select("*").eq("user_id", user.id)

  const completedLessonIds = new Set(courseProgress?.filter((p) => p.completed).map((p) => p.lesson_id) || [])

  const allCompleted = lessons.every((lesson) => completedLessonIds.has(lesson.id))

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard">← Back</Link>
            </Button>
            <h1 className="text-xl font-semibold">Financial Literacy Course</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {/* Progress Overview */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Your Progress</CardTitle>
            <CardDescription>Complete all {lessons.length} lessons to qualify for funding</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {completedLessonIds.size} of {lessons.length} lessons completed
              </span>
              <span className="font-medium">{Math.round((completedLessonIds.size / lessons.length) * 100)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${(completedLessonIds.size / lessons.length) * 100}%` }}
              />
            </div>
            {allCompleted && (
              <div className="mt-4 rounded-lg bg-primary/10 p-4 text-center">
                <p className="font-semibold text-primary">🎉 Congratulations! You've completed the course</p>
                <p className="mt-1 text-sm text-muted-foreground">You can now submit your business idea</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lessons List */}
        <div className="space-y-4">
          {lessons.map((lesson) => {
            const isCompleted = completedLessonIds.has(lesson.id)

            return (
              <Card key={lesson.id}>
                <CardContent className="flex items-center justify-between p-6">
                  <div className="flex items-start gap-4">
                    {isCompleted ? (
                      <CheckCircle2 className="h-6 w-6 flex-shrink-0 text-primary" />
                    ) : (
                      <Circle className="h-6 w-6 flex-shrink-0 text-muted-foreground" />
                    )}
                    <div>
                      <h3 className="font-semibold">
                        Lesson {lesson.id}: {lesson.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">{lesson.description}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{lesson.duration}</p>
                    </div>
                  </div>
                  <Button asChild variant={isCompleted ? "outline" : "default"}>
                    <Link href={`/dashboard/course/${lesson.id}`}>{isCompleted ? "Review" : "Start"}</Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </main>
    </div>
  )
}
