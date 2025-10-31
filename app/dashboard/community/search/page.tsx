import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { SearchUserForm } from "./search-user-form"

export default async function SearchUserPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    redirect("/auth")
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/community">← Back</Link>
            </Button>
            <h1 className="text-xl font-semibold">Search User</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Find a User to Vouch For</CardTitle>
            <CardDescription>Search by email or display name to find their business</CardDescription>
          </CardHeader>
          <CardContent>
            <SearchUserForm />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
