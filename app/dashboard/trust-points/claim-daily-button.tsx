"use client"

import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function ClaimDailyButton({ canClaim }: { canClaim: boolean }) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleClaim = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/claim-daily-trust-points", {
        method: "POST",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to claim daily points")
      }

      router.refresh()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button className="w-full" disabled={!canClaim || isLoading} onClick={handleClaim}>
        {isLoading ? "Claiming..." : canClaim ? "Claim 5 TP" : "Come Back Later"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
