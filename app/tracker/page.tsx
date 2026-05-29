"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { PieChart, Pie, Cell } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TrackerHomeSkeleton } from "@/components/tracker/tracker-home-skeleton"
import { Plus, Wallet, ChevronRight } from "lucide-react"
import { format, startOfWeek, startOfMonth, endOfWeek, endOfMonth, subWeeks, subMonths } from "date-fns"

type Category = { id: string; name: string; slug: string; icon: string | null; user_id: string | null }
type Expense = {
  id: string
  amount: number
  currency: string
  merchant: string | null
  category_id: string
  expense_date: string
  note: string | null
  source: string
  created_at: string
}

const CHART_COLORS = ["#3b82f6", "#22c55e", "#eab308", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"]

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: currency === "CLP" ? "CLP" : "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function TrackerHomePage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [expRes, catRes] = await Promise.all([
        fetch("/api/expenses?limit=100"),
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
  const thisWeekStart = startOfWeek(now)
  const thisWeekEnd = endOfWeek(now)
  const thisMonthStart = startOfMonth(now)
  const thisMonthEnd = endOfMonth(now)
  const lastWeekStart = startOfWeek(subWeeks(now, 1))
  const lastWeekEnd = endOfWeek(subWeeks(now, 1))
  const lastMonthStart = startOfMonth(subMonths(now, 1))
  const lastMonthEnd = endOfMonth(subMonths(now, 1))

  const inRange = (dateStr: string, start: Date, end: Date) => {
    const d = new Date(dateStr)
    return d >= start && d <= end
  }

  const totalThisWeek = expenses
    .filter((e) => inRange(e.expense_date, thisWeekStart, thisWeekEnd))
    .reduce((s, e) => s + e.amount, 0)
  const totalLastWeek = expenses
    .filter((e) => inRange(e.expense_date, lastWeekStart, lastWeekEnd))
    .reduce((s, e) => s + e.amount, 0)
  const totalThisMonth = expenses
    .filter((e) => inRange(e.expense_date, thisMonthStart, thisMonthEnd))
    .reduce((s, e) => s + e.amount, 0)
  const totalLastMonth = expenses
    .filter((e) => inRange(e.expense_date, lastMonthStart, lastMonthEnd))
    .reduce((s, e) => s + e.amount, 0)

  const byCategory = expenses
    .filter((e) => inRange(e.expense_date, thisMonthStart, thisMonthEnd))
    .reduce<Record<string, number>>((acc, e) => {
      acc[e.category_id] = (acc[e.category_id] || 0) + e.amount
      return acc
    }, {})
  const chartData = Object.entries(byCategory).map(([categoryId, value]) => ({
    name: categoryMap[categoryId] || "Other",
    value: Math.round(value),
    fill: CHART_COLORS[Object.keys(byCategory).indexOf(categoryId) % CHART_COLORS.length],
  }))

  const recentExpenses = expenses.slice(0, 20)

  if (loading) {
    return <TrackerHomeSkeleton />
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">This week</p>
            <p className="text-xl font-bold">{formatMoney(totalThisWeek, "CLP")}</p>
            {totalLastWeek > 0 && (
              <p className="text-xs text-muted-foreground">
                vs {formatMoney(totalLastWeek, "CLP")} last week
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">This month</p>
            <p className="text-xl font-bold">{formatMoney(totalThisMonth, "CLP")}</p>
            {totalLastMonth > 0 && (
              <p className="text-xs text-muted-foreground">
                vs {formatMoney(totalLastMonth, "CLP")} last month
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By category (this month)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={Object.fromEntries(chartData.map((d) => [d.name, { label: d.name }]))}
              className="h-[200px] w-full"
            >
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recent expenses</h2>
        <Button asChild size="sm">
          <Link href="/tracker/expenses/new">
            <Plus className="size-4" />
            Add expense
          </Link>
        </Button>
      </div>

      {recentExpenses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wallet className="size-12 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">No expenses yet</p>
            <Button asChild className="mt-4">
              <Link href="/tracker/expenses/new">Add your first expense</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-1">
          {recentExpenses.map((e) => (
            <li key={e.id}>
              <Link
                href={`/tracker/expenses/${e.id}`}
                className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
              >
                <div>
                  <p className="font-medium">{e.merchant || "Expense"}</p>
                  <p className="text-xs text-muted-foreground">
                    {categoryMap[e.category_id]} · {e.expense_date}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{formatMoney(e.amount, e.currency)}</span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="pb-4">
        <Button asChild className="w-full" size="lg">
          <Link href="/tracker/expenses/new">
            <Plus className="size-5" />
            Add expense
          </Link>
        </Button>
      </div>
    </div>
  )
}
