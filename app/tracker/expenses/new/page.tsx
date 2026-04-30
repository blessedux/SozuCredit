"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
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
import { format } from "date-fns"

type Category = { id: string; name: string; slug: string }

export default function NewExpensePage() {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [recentMerchants, setRecentMerchants] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [amount, setAmount] = useState("")
  const [merchant, setMerchant] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [note, setNote] = useState("")

  useEffect(() => {
    async function load() {
      const [catRes, expRes] = await Promise.all([
        fetch("/api/categories"),
        fetch("/api/expenses?limit=50"),
      ])
      const cats: Category[] = catRes.ok ? await catRes.json() : []
      setCategories(cats)
      if (expRes.ok) {
        const expenses = await expRes.json()
        const merchants = [...new Set(expenses.map((e: { merchant: string | null }) => e.merchant).filter(Boolean))] as string[]
        setRecentMerchants(merchants.slice(0, 15))
        if (cats.length && expenses.length) {
          const lastCat = expenses[0]?.category_id
          if (lastCat) setCategoryId(lastCat)
        }
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (categories.length && !categoryId) setCategoryId(categories[0].id)
  }, [categories, categoryId])

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
    setLoading(true)
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: num,
          currency: "CLP",
          merchant: merchant || null,
          category_id: categoryId,
          date,
          note: note || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to add expense")
      }
      toast.success("Expense added")
      router.push("/tracker")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add expense")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/tracker">
            <ChevronLeft className="size-5" />
          </Link>
        </Button>
        <h2 className="text-lg font-semibold">Add expense</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick add</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="merchant">Merchant</Label>
              <Input
                id="merchant"
                list="merchants"
                placeholder="Where did you spend?"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
              />
              <datalist id="merchants">
                {recentMerchants.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId} required>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
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
                placeholder="Optional note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Adding…" : "Add expense"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
