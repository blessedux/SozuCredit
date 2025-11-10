import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Award, Calendar, TrendingUp, Users } from "lucide-react"
import { ClaimDailyButton } from "./claim-daily-button"

export default async function TrustPointsPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    redirect("/auth")
  }

  // Get trust points
  const { data: trustPoints } = await supabase.from("trust_points").select("*").eq("user_id", user.id).single()

  // Get vouches made by user
  const { data: vouchesMade } = await supabase
    .from("vouches")
    .select(
      `
      *,
      business_ideas:business_idea_id (
        title,
        status
      )
    `,
    )
    .eq("voucher_id", user.id)
    .order("created_at", { ascending: false })

  // Calculate time until next daily credit
  const lastCredit = trustPoints?.last_daily_credit ? new Date(trustPoints.last_daily_credit) : new Date()
  const nextCredit = new Date(lastCredit)
  nextCredit.setDate(nextCredit.getDate() + 1)
  const now = new Date()
  const hoursUntilNext = Math.max(0, Math.floor((nextCredit.getTime() - now.getTime()) / (1000 * 60 * 60)))
  const canClaimDaily = hoursUntilNext === 0

  const totalSpent = vouchesMade?.reduce((sum, v) => sum + (v.trust_points_spent || 0), 0) || 0
  const totalEarned = 5 // Starting points + daily credits (simplified)

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard">← Back</Link>
            </Button>
            <h1 className="text-xl font-semibold">Trust Points</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Balance Overview */}
        <div className="mb-8 grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardDescription>Current Balance</CardDescription>
              <CardTitle className="text-5xl">{trustPoints?.balance || 0} TP</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span>Earn 5 TP daily • Use them to vouch for businesses</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Next Daily Credit</CardDescription>
              <CardTitle className="text-3xl">{canClaimDaily ? "Ready!" : `${hoursUntilNext}h`}</CardTitle>
            </CardHeader>
            <CardContent>
              <ClaimDailyButton canClaim={canClaimDaily} />
            </CardContent>
          </Card>
        </div>

        {/* Stats */}
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Earned</p>
                  <p className="text-2xl font-bold">{totalEarned} TP</p>
                </div>
                <Award className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Spent</p>
                  <p className="text-2xl font-bold">{totalSpent} TP</p>
                </div>
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Businesses Vouched</p>
                  <p className="text-2xl font-bold">{vouchesMade?.length || 0}</p>
                </div>
                <Calendar className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* How It Works */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>How Trust Points Work</CardTitle>
            <CardDescription>Understanding the trust economy</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h3 className="font-semibold">Earning Points</h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Get 1 trust point when someone signs up using your referral code</li>
                  <li>• Starting balance of 0 TP when you join</li>
                  <li>• Check back daily to claim your points</li>
                  <li>• Points accumulate over time</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">Using Points</h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Vouch for businesses you believe in</li>
                  <li>• Spend 1 or more points per vouch</li>
                  <li>• Your vouches help businesses get funding</li>
                  <li>• Build your reputation in the community</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vouch History */}
        <Card>
          <CardHeader>
            <CardTitle>Your Vouches</CardTitle>
            <CardDescription>Businesses you've supported with trust points</CardDescription>
          </CardHeader>
          <CardContent>
            {vouchesMade && vouchesMade.length > 0 ? (
              <div className="space-y-3">
                {vouchesMade.map((vouch: any) => (
                  <div key={vouch.id} className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{vouch.business_ideas?.title || "Unknown Business"}</p>
                        <Badge
                          variant="secondary"
                          className={
                            vouch.business_ideas?.status === "approved"
                              ? "bg-green-500/10 text-green-500"
                              : "bg-yellow-500/10 text-yellow-500"
                          }
                        >
                          {vouch.business_ideas?.status || "pending"}
                        </Badge>
                      </div>
                      {vouch.message && <p className="mt-1 text-sm text-muted-foreground">"{vouch.message}"</p>}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(vouch.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="outline" className="ml-4">
                      {vouch.trust_points_spent} TP
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                <Users className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
                <p>You haven't vouched for any businesses yet</p>
                <p className="mt-1 text-sm">Explore the community to find businesses to support</p>
                <Button asChild className="mt-4" size="sm">
                  <Link href="/dashboard/community">Browse Businesses</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
