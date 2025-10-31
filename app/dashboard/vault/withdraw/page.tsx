import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { WithdrawAliasForm } from "./withdraw-alias-form"
import { WithdrawQRForm } from "./withdraw-qr-form"

export default async function WithdrawPage() {
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
            <h1 className="text-xl font-semibold">Withdraw Funds</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Available Balance</CardTitle>
            <CardDescription className="text-2xl font-bold text-foreground">
              ${Number(vault.balance).toFixed(2)}
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Withdraw Method</CardTitle>
            <CardDescription>Choose how you want to send funds</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="alias" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="alias">By Alias</TabsTrigger>
                <TabsTrigger value="qr">By QR Code</TabsTrigger>
              </TabsList>
              <TabsContent value="alias" className="mt-6">
                <WithdrawAliasForm vaultId={vault.id} currentBalance={Number(vault.balance)} />
              </TabsContent>
              <TabsContent value="qr" className="mt-6">
                <WithdrawQRForm vaultId={vault.id} currentBalance={Number(vault.balance)} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="mt-6 border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <h3 className="mb-2 font-semibold">About Withdrawals</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Withdrawals are processed instantly</li>
              <li>• You can send to any user's alias or scan their QR code</li>
              <li>• Funds are deducted from your vault balance</li>
              <li>• All transactions are recorded for your records</li>
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
