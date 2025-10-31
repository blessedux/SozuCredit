import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { VouchForm } from "./vouch-form"

export default async function BusinessDetailPage({
  params,
}: {
  params: Promise<{ businessId: string }>
}) {
  const { businessId } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    redirect("/auth")
  }

  // Get business details
  const { data: business } = await supabase
    .from("business_ideas")
    .select(
      `
      *,
      profiles:user_id (
        display_name,
        email
      )
    `,
    )
    .eq("id", businessId)
    .single()

  if (!business) {
    redirect("/dashboard/community")
  }

  // Get user's trust points
  const { data: trustPoints } = await supabase.from("trust_points").select("*").eq("user_id", user.id).single()

  // Get all vouches for this business
  const { data: vouches } = await supabase
    .from("vouches")
    .select(
      `
      *,
      profiles:voucher_id (
        display_name
      )
    `,
    )
    .eq("business_idea_id", businessId)
    .order("created_at", { ascending: false })

  // Check if user has already vouched
  const userVouch = vouches?.find((v: any) => v.voucher_id === user.id)

  const totalVouches = vouches?.length || 0
  const totalTrustPoints = vouches?.reduce((sum: number, v: any) => sum + (v.trust_points_spent || 0), 0) || 0

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/community">← Back</Link>
            </Button>
            <h1 className="text-xl font-semibold">Business Details</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Your Trust Points:</span>
            <Badge variant="secondary" className="text-base">
              {trustPoints?.balance || 0} TP
            </Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-6 lg:col-span-2">
            {/* Business Details */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl">{business.title}</CardTitle>
                    <CardDescription className="mt-2">
                      by {business.profiles?.display_name || "Anonymous"}
                    </CardDescription>
                  </div>
                  <Badge className="bg-green-500/10 text-green-500">{business.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="mb-2 font-semibold">About This Business</h3>
                  <p className="leading-relaxed text-muted-foreground">{business.description}</p>
                </div>
                <div className="flex items-center justify-between border-t pt-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Funding Goal</p>
                    <p className="text-2xl font-bold">${business.funding_goal}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Community Support</p>
                    <p className="text-2xl font-bold">{totalVouches} vouches</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Vouches List */}
            <Card>
              <CardHeader>
                <CardTitle>Community Vouches</CardTitle>
                <CardDescription>
                  {totalVouches} people have vouched with {totalTrustPoints} trust points total
                </CardDescription>
              </CardHeader>
              <CardContent>
                {vouches && vouches.length > 0 ? (
                  <div className="space-y-3">
                    {vouches.map((vouch: any) => (
                      <div key={vouch.id} className="flex items-start justify-between rounded-lg border p-4">
                        <div className="flex-1">
                          <p className="font-medium">{vouch.profiles?.display_name}</p>
                          {vouch.message && <p className="mt-1 text-sm text-muted-foreground">"{vouch.message}"</p>}
                          <p className="mt-1 text-xs text-muted-foreground">
                            {new Date(vouch.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant="secondary">{vouch.trust_points_spent} TP</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    <p>No vouches yet</p>
                    <p className="mt-1 text-sm">Be the first to support this business!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Vouch Form */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Vouch for This Business</CardTitle>
                <CardDescription>
                  {userVouch
                    ? "You've already vouched for this business"
                    : "Show your support by spending trust points"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {userVouch ? (
                  <div className="space-y-4">
                    <div className="rounded-lg bg-primary/10 p-4 text-center">
                      <p className="font-semibold text-primary">Thank you for your support!</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        You vouched with {userVouch.trust_points_spent} trust points
                      </p>
                    </div>
                    {userVouch.message && (
                      <div>
                        <p className="text-sm font-medium">Your message:</p>
                        <p className="mt-1 text-sm text-muted-foreground">"{userVouch.message}"</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <VouchForm
                    businessId={businessId}
                    userId={user.id}
                    availableTrustPoints={trustPoints?.balance || 0}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
