"use client"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function CompleteButton({ lessonId, userId }: { lessonId: number; userId: string }) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleComplete = async () => {
    setIsLoading(true)
    const supabase = createClient()

    try {
      // Insert or update course progress
      const { error } = await supabase.from("course_progress").upsert({
        user_id: userId,
        lesson_id: lessonId,
        completed: true,
      })

      if (error) throw error

      router.refresh()
    } catch (error) {
      console.error("Error completing lesson:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button onClick={handleComplete} disabled={isLoading}>
      {isLoading ? "Saving..." : "Complete Lesson"}
    </Button>
  )
}
