import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { CompleteButton } from "./complete-button"

const lessonContent: Record<number, { title: string; content: string[] }> = {
  1: {
    title: "Introduction to Micro-Credit",
    content: [
      "Micro-credit is a financial service that provides small loans to entrepreneurs who lack access to traditional banking services.",
      "These loans help people start or expand small businesses, creating economic opportunities in underserved communities.",
      "Unlike traditional loans, micro-credit focuses on trust and community support rather than just credit scores.",
      "Our platform combines education, community vouching, and financial tools to ensure responsible lending and borrowing.",
    ],
  },
  2: {
    title: "Financial Responsibility",
    content: [
      "Taking a loan is a serious commitment that requires careful planning and discipline.",
      "Before borrowing, create a detailed budget showing how you'll use the funds and generate income to repay the loan.",
      "Set aside a portion of your earnings regularly to ensure timely repayment.",
      "Remember: your reputation in the community depends on honoring your commitments.",
    ],
  },
  3: {
    title: "Business Planning Basics",
    content: [
      "A solid business plan is essential for success. Start by clearly defining what problem your business solves.",
      "Identify your target customers and understand their needs deeply.",
      "Calculate your startup costs, ongoing expenses, and projected revenue realistically.",
      "Plan for challenges and have backup strategies. Most businesses face obstacles—preparation is key.",
    ],
  },
  4: {
    title: "Community & Trust",
    content: [
      "Our platform is built on community trust. When people vouch for your business, they're putting their reputation on the line.",
      "Vouches show that real people believe in your idea and would support it as customers.",
      "Building trust takes time. Be transparent about your plans and progress with your community.",
      "As you succeed, pay it forward by vouching for other promising businesses.",
    ],
  },
  5: {
    title: "Managing Your Funds",
    content: [
      "Once you receive funding, manage it wisely. Keep detailed records of all income and expenses.",
      "Use your vault to store funds securely and earn yield on money you're not immediately using.",
      "Withdraw only what you need for business expenses—avoid mixing personal and business finances.",
      "Review your financial position regularly and adjust your strategy as needed.",
    ],
  },
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ lessonId: string }>
}) {
  const { lessonId } = await params
  const lessonIdNum = Number.parseInt(lessonId)

  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    redirect("/auth")
  }

  const lesson = lessonContent[lessonIdNum]
  if (!lesson) {
    redirect("/dashboard/course")
  }

  // Check if lesson is completed
  const { data: progress } = await supabase
    .from("course_progress")
    .select("*")
    .eq("user_id", user.id)
    .eq("lesson_id", lessonIdNum)
    .single()

  const isCompleted = progress?.completed || false

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/course">← Back to Course</Link>
            </Button>
            <h1 className="text-xl font-semibold">Lesson {lessonIdNum}</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{lesson.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {lesson.content.map((paragraph, index) => (
              <p key={index} className="leading-relaxed text-muted-foreground">
                {paragraph}
              </p>
            ))}

            <div className="flex items-center justify-between border-t pt-6">
              <div className="text-sm text-muted-foreground">
                {isCompleted ? "✓ Completed" : "Mark as complete to continue"}
              </div>
              <div className="flex gap-2">
                {lessonIdNum > 1 && (
                  <Button asChild variant="outline">
                    <Link href={`/dashboard/course/${lessonIdNum - 1}`}>Previous</Link>
                  </Button>
                )}
                {!isCompleted ? (
                  <CompleteButton lessonId={lessonIdNum} userId={user.id} />
                ) : lessonIdNum < 5 ? (
                  <Button asChild>
                    <Link href={`/dashboard/course/${lessonIdNum + 1}`}>Next Lesson</Link>
                  </Button>
                ) : (
                  <Button asChild>
                    <Link href="/dashboard/course">Back to Course</Link>
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
