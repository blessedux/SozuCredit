"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function VouchForm({
  businessId,
  userId,
  availableTrustPoints,
}: {
  businessId: string
  userId: string
  availableTrustPoints: number
}) {
  const [trustPoints, setTrustPoints] = useState("1")
  const [message, setMessage] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const pointsToSpend = Number.parseInt(trustPoints)

    if (pointsToSpend > availableTrustPoints) {
      setError("You don't have enough trust points")
      setIsLoading(false)
      return
    }

    if (pointsToSpend < 1) {
      setError("You must spend at least 1 trust point")
      setIsLoading(false)
      return
    }

    const supabase = createClient()

    try {
      // Insert vouch
      const { error: vouchError } = await supabase.from("vouches").insert({
        business_idea_id: businessId,
        voucher_id: userId,
        trust_points_spent: pointsToSpend,
        message: message || null,
      })

      if (vouchError) throw vouchError

      // Update trust points balance
      const { error: updateError } = await supabase
        .from("trust_points")
        .update({
          balance: availableTrustPoints - pointsToSpend,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)

      if (updateError) throw updateError

      router.refresh()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="trustPoints">Trust Points to Spend</Label>
        <Input
          id="trustPoints"
          type="number"
          min="1"
          max={availableTrustPoints}
          required
          value={trustPoints}
          onChange={(e) => setTrustPoints(e.target.value)}
          disabled={availableTrustPoints === 0}
        />
        <p className="text-xs text-muted-foreground">Available: {availableTrustPoints} TP</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">Message (Optional)</Label>
        <Textarea
          id="message"
          placeholder="Why do you support this business?"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={availableTrustPoints === 0}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {availableTrustPoints === 0 ? (
        <div className="rounded-lg bg-muted p-3 text-center text-sm text-muted-foreground">
          You don't have any trust points. Come back tomorrow to earn 5 more!
        </div>
      ) : (
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Vouching..." : "Vouch for This Business"}
        </Button>
      )}
    </form>
  )
}
