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

export function WithdrawAliasForm({ vaultId, currentBalance }: { vaultId: string; currentBalance: number }) {
  const [recipientAlias, setRecipientAlias] = useState("")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const withdrawAmount = Number.parseFloat(amount)

    if (withdrawAmount <= 0) {
      setError("Amount must be greater than 0")
      setIsLoading(false)
      return
    }

    if (withdrawAmount > currentBalance) {
      setError("Insufficient balance")
      setIsLoading(false)
      return
    }

    const supabase = createClient()

    try {
      // Find recipient vault by alias
      const { data: recipientVault, error: findError } = await supabase
        .from("vaults")
        .select("*")
        .eq("alias", recipientAlias)
        .single()

      if (findError || !recipientVault) {
        throw new Error("Recipient alias not found")
      }

      // Update sender vault balance
      const newSenderBalance = currentBalance - withdrawAmount
      const { error: senderError } = await supabase
        .from("vaults")
        .update({
          balance: newSenderBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("id", vaultId)

      if (senderError) throw senderError

      // Update recipient vault balance
      const newRecipientBalance = Number(recipientVault.balance) + withdrawAmount
      const { error: recipientError } = await supabase
        .from("vaults")
        .update({
          balance: newRecipientBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("id", recipientVault.id)

      if (recipientError) throw recipientError

      // Create withdrawal transaction for sender
      const { error: withdrawError } = await supabase.from("transactions").insert({
        vault_id: vaultId,
        type: "withdrawal",
        amount: withdrawAmount,
        description: description || `Sent to ${recipientAlias}`,
      })

      if (withdrawError) throw withdrawError

      // Create deposit transaction for recipient
      const { error: depositError } = await supabase.from("transactions").insert({
        vault_id: recipientVault.id,
        type: "deposit",
        amount: withdrawAmount,
        description: description || "Received from another user",
      })

      if (depositError) throw depositError

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
        <Label htmlFor="recipientAlias">Recipient Alias</Label>
        <Input
          id="recipientAlias"
          type="text"
          placeholder="e.g., abc12345"
          required
          value={recipientAlias}
          onChange={(e) => setRecipientAlias(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">Enter the recipient's vault alias</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount">Amount ($)</Label>
        <Input
          id="amount"
          type="number"
          placeholder="50.00"
          required
          min="0.01"
          step="0.01"
          max={currentBalance}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">Available: ${currentBalance.toFixed(2)}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (Optional)</Label>
        <Textarea
          id="description"
          placeholder="e.g., Payment for services, Gift..."
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
          {isLoading ? "Processing..." : "Send Funds"}
        </Button>
      </div>
    </form>
  )
}
