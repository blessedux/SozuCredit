"use client"

import Link from "next/link"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function DepositForm({ vaultId, currentBalance }: { vaultId: string; currentBalance: number }) {
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const depositAmount = Number.parseFloat(amount)

    if (depositAmount <= 0) {
      setError("Amount must be greater than 0")
      setIsLoading(false)
      return
    }

    const supabase = createClient()

    try {
      // Update vault balance
      const newBalance = currentBalance + depositAmount
      const { error: vaultError } = await supabase
        .from("vaults")
        .update({
          balance: newBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("id", vaultId)

      if (vaultError) throw vaultError

      // Create transaction record
      const { error: transactionError } = await supabase.from("transactions").insert({
        vault_id: vaultId,
        type: "deposit",
        amount: depositAmount,
        description: description || "Deposit to vault",
      })

      if (transactionError) throw transactionError

      router.push("/dashboard/vault")
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
        <Label htmlFor="amount">Amount ($)</Label>
        <Input
          id="amount"
          type="number"
          placeholder="100.00"
          required
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">Current balance: ${currentBalance.toFixed(2)}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (Optional)</Label>
        <Textarea
          id="description"
          placeholder="e.g., Initial deposit, Monthly savings..."
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1 bg-transparent" asChild>
          <Link href="/dashboard/vault">Cancel</Link>
        </Button>
        <Button type="submit" className="flex-1" disabled={isLoading}>
          {isLoading ? "Processing..." : "Deposit Funds"}
        </Button>
      </div>
    </form>
  )
}
