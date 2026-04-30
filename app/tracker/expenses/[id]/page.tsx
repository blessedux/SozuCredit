"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronLeft } from "lucide-react"

type Category = { id: string; name: string; slug: string }
type Expense = {
  id: string
  amount: number
  currency: string
  merchant: string | null
  category_id: string
  expense_date: string
  note: string | null
}

export default function EditExpensePage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [categories, setCategories] = useState<Category[]>([])
  const [expense, setExpense] = useState<Expense | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [amount, setAmount] = useState("")
  const [merchant, setMerchant] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [date, setDate] = useState("")
  const [note, setNote] = useState("")

  useEffect(() => {
    async function load() {
      try {
        const [catRes, expRes] = await Promise.all([
          fetch("/api/categories"),
          fetch(`/api/expenses/${id}`),
        ])
        if (catRes.ok) setCategories(await catRes.json())
        if (expRes.ok) {
          const data = await expRes.json()
          setExpense(data)
          setAmount(String(data.amount))
          setMerchant(data.merchant || "")
          setCategoryId(data.category_id)
          setDate(data.expense_date)
          setNote(data.note || "")
        } else {
          setExpense(null)
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const num = parseFloat(amount.replace(/,/g, "."))
    if (Number.isNaN(num) || num <= 0) {
      toast.error("Enter a valid amount")
      return
    }
    if (!categoryId) {
      toast.error("Select a category")
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: num,
          merchant: merchant || null,
          category_id: categoryId,
          date,
          note: note || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to update")
      }
      toast.success("Expense updated")
      router.push("/tracker")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this expense?")) return
    setSaving(true)
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      toast.success("Expense deleted")
      router.push("/tracker")
      router.refresh()
    } catch (err) {
      toast.error("Failed to delete")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-muted-foreground">Loading…</div>
  }
  if (!expense) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Expense not found.</p>
        <Button asChild>
          <Link href="/tracker">Back to tracker</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/tracker">
            <ChevronLeft className="size-5" />
          </Link>
        </Button>
        <h2 className="text-lg font-semibold">Edit expense</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Expense details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="merchant">Merchant</Label>
              <Input
                id="merchant"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId} required>
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="note">Note (optional)</Label>
              <Input
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={saving}
              >
                Delete
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
