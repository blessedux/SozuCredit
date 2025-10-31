import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { DepositForm } from "./deposit-form"

export default async function DepositPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    redirect("/auth")
  }

  // Get vault
  const { data: vault } = await supabase.from("vaults").select("*").eq("user_id", user.id).single()

  if (!vault) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/vault">← Back</Link>
            </Button>
            <h1 className="text-xl font-semibold">Deposit Funds</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Add Funds to Your Vault</CardTitle>
            <CardDescription>Deposit money and start earning {vault.yield_rate}% annual yield</CardDescription>
          </CardHeader>
          <CardContent>
            <DepositForm vaultId={vault.id} currentBalance={Number(vault.balance)} />
          </CardContent>
        </Card>

        <Card className="mt-6 border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <h3 className="mb-2 font-semibold">About Deposits</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Funds are immediately available in your vault</li>
              <li>• Start earning {vault.yield_rate}% annual yield automatically</li>
              <li>• Withdraw anytime using your alias or QR code</li>
              <li>• All transactions are secure and tracked</li>
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
