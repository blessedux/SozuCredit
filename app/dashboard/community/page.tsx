import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Search } from "lucide-react"

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>
}) {
  const { search } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    redirect("/auth")
  }

  // Get user's trust points
  const { data: trustPoints } = await supabase.from("trust_points").select("*").eq("user_id", user.id).single()

  // Get all approved business ideas (excluding user's own)
  let query = supabase
    .from("business_ideas")
    .select(
      `
      *,
      profiles:user_id (
        display_name,
        email
      ),
      vouches:vouches(count)
    `,
    )
    .eq("status", "approved")
    .neq("user_id", user.id)

  if (search) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
  }

  const { data: businesses } = await query.order("created_at", { ascending: false })

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard">← Back</Link>
            </Button>
            <h1 className="text-xl font-semibold">Community Businesses</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Your Trust Points:</span>
            <Badge variant="secondary" className="text-base">
              {trustPoints?.balance || 0} TP
            </Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <form action="/dashboard/community" method="get" className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  name="search"
                  placeholder="Search businesses by name or description..."
                  defaultValue={search}
                  className="pl-9"
                />
              </div>
              <Button type="submit">Search</Button>
            </form>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Vouch for businesses you believe in by spending your trust points. Each vouch shows your support and helps
              them get funding. You earn 5 trust points daily, so use them wisely to support promising entrepreneurs.
            </p>
          </CardContent>
        </Card>

        {/* Business List */}
        {businesses && businesses.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2">
            {businesses.map((business: any) => {
              const vouchCount = business.vouches?.[0]?.count || 0

              return (
                <Card key={business.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-xl">{business.title}</CardTitle>
                        <CardDescription className="mt-1">
                          by {business.profiles?.display_name || "Anonymous"}
                        </CardDescription>
                      </div>
                      <Badge variant="secondary">{vouchCount} vouches</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="line-clamp-3 text-sm text-muted-foreground">{business.description}</p>
                    <div className="flex items-center justify-between border-t pt-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Funding Goal</p>
                        <p className="font-semibold">${business.funding_goal}</p>
                      </div>
                      <Button asChild size="sm">
                        <Link href={`/dashboard/community/${business.id}`}>View & Vouch</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                {search ? "No businesses found matching your search" : "No businesses available to vouch for yet"}
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
