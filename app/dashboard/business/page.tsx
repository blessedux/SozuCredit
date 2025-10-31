import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

export default async function BusinessPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    redirect("/auth")
  }

  // Get business idea
  const { data: businessIdea } = await supabase.from("business_ideas").select("*").eq("user_id", user.id).single()

  if (!businessIdea) {
    redirect("/dashboard/business/new")
  }

  // Get vouches for this business
  const { data: vouches } = await supabase
    .from("vouches")
    .select(`
      *,
      profiles:voucher_id (
        display_name
      )
    `)
    .eq("business_idea_id", businessIdea.id)

  const totalVouches = vouches?.length || 0
  const totalTrustPoints = vouches?.reduce((sum, v) => sum + (v.trust_points_spent || 0), 0) || 0

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-500",
    approved: "bg-green-500/10 text-green-500",
    funded: "bg-blue-500/10 text-blue-500",
    rejected: "bg-red-500/10 text-red-500",
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard">← Back</Link>
            </Button>
            <h1 className="text-xl font-semibold">Your Business</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {/* Business Details */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">{businessIdea.title}</CardTitle>
                <CardDescription className="mt-2">
                  Submitted {new Date(businessIdea.created_at).toLocaleDateString()}
                </CardDescription>
              </div>
              <Badge className={statusColors[businessIdea.status]}>{businessIdea.status}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="mb-2 font-semibold">Description</h3>
              <p className="leading-relaxed text-muted-foreground">{businessIdea.description}</p>
            </div>
            <div className="flex items-center justify-between border-t pt-4">
              <div>
                <p className="text-sm text-muted-foreground">Funding Goal</p>
                <p className="text-2xl font-bold">${businessIdea.funding_goal}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Community Support</p>
                <p className="text-2xl font-bold">{totalVouches} vouches</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vouches */}
        <Card>
          <CardHeader>
            <CardTitle>Community Vouches</CardTitle>
            <CardDescription>
              {totalVouches} people have vouched for your business with {totalTrustPoints} trust points
            </CardDescription>
          </CardHeader>
          <CardContent>
            {vouches && vouches.length > 0 ? (
              <div className="space-y-3">
                {vouches.map((vouch: any) => (
                  <div key={vouch.id} className="flex items-start justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium">{vouch.profiles?.display_name}</p>
                      {vouch.message && <p className="mt-1 text-sm text-muted-foreground">"{vouch.message}"</p>}
                    </div>
                    <Badge variant="secondary">{vouch.trust_points_spent} TP</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <p>No vouches yet</p>
                <p className="mt-1 text-sm">Share your business with the community to get support</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
