"use client"

import { useEffect, useState, useCallback } from "react"
import { BarChart, Bar, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Download } from "lucide-react"
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, format } from "date-fns"

type Expense = {
  id: string
  amount: number
  currency: string
  merchant: string | null
  category_id: string
  expense_date: string
}

type Category = { id: string; name: string }

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: currency === "CLP" ? "CLP" : "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function TrackerReportsPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<"week" | "month">("month")

  const fetchData = useCallback(async () => {
    try {
      const [expRes, catRes] = await Promise.all([
        fetch("/api/expenses?limit=500"),
        fetch("/api/categories"),
      ])
      if (expRes.ok) setExpenses(await expRes.json())
      if (catRes.ok) setCategories(await catRes.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c.name]))
  const now = new Date()
  const rangeStart = period === "week" ? startOfWeek(now) : startOfMonth(now)
  const rangeEnd = period === "week" ? endOfWeek(now) : endOfMonth(now)

  const inRange = (dateStr: string) => {
    const d = new Date(dateStr)
    return d >= rangeStart && d <= rangeEnd
  }

  const filtered = expenses.filter((e) => inRange(e.expense_date))
  const byCategory = filtered.reduce<Record<string, number>>((acc, e) => {
    acc[e.category_id] = (acc[e.category_id] || 0) + e.amount
    return acc
  }, {})

  const chartData = Object.entries(byCategory).map(([id, value]) => ({
    name: categoryMap[id] || "Other",
    total: Math.round(value),
  }))

  const total = filtered.reduce((s, e) => s + e.amount, 0)

  function exportCSV() {
    const headers = ["Date", "Merchant", "Category", "Amount", "Currency"]
    const rows = filtered
      .sort((a, b) => b.expense_date.localeCompare(a.expense_date))
      .map((e) => [
        e.expense_date,
        e.merchant || "",
        categoryMap[e.category_id] || "",
        e.amount,
        e.currency,
      ])
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `expenses-${period}-${format(now, "yyyy-MM-dd")}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Reports</h2>
        <div className="flex gap-2">
          <Button
            variant={period === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod("week")}
          >
            Week
          </Button>
          <Button
            variant={period === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod("month")}
          >
            Month
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="size-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Total ({period === "week" ? "this week" : "this month"})
          </p>
          <p className="text-2xl font-bold">{formatMoney(total, "CLP")}</p>
        </CardContent>
      </Card>

      {chartData.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By category</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={Object.fromEntries(chartData.map((d) => [d.name, { label: d.name }]))}
              className="h-[280px] w-full"
            >
              <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20 }}>
                <ChartTooltip content={<ChartTooltipContent />} />
                <XAxis type="number" tickFormatter={(v) => `${v}`} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                <Bar dataKey="total" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No expenses in this period.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
