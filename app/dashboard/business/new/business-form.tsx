"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function BusinessForm({ userId }: { userId: string }) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [fundingGoal, setFundingGoal] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const supabase = createClient()

    try {
      const { error } = await supabase.from("business_ideas").insert({
        user_id: userId,
        title,
        description,
        funding_goal: Number.parseFloat(fundingGoal),
        course_completed: true,
        status: "pending",
      })

      if (error) throw error

      router.push("/dashboard/business")
      router.refresh()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Business Name</Label>
        <Input
          id="title"
          placeholder="e.g., Local Bakery, Mobile Repair Service"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Business Description</Label>
        <Textarea
          id="description"
          placeholder="Describe your business idea, target customers, and how you'll use the funding..."
          required
          rows={6}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Be specific about what problem you're solving and why people would support your business
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="fundingGoal">Funding Goal ($)</Label>
        <Input
          id="fundingGoal"
          type="number"
          placeholder="500"
          required
          min="100"
          max="10000"
          step="50"
          value={fundingGoal}
          onChange={(e) => setFundingGoal(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">Typical micro-credit loans range from $100 to $10,000</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Submitting..." : "Submit Business Idea"}
      </Button>
    </form>
  )
}
