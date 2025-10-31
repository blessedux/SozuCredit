"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowDownToLine, ArrowUpFromLine, TrendingUp, Wallet } from "lucide-react"

export default function VaultPage() {
  const router = useRouter()

  const [vault, setVault] = useState<any>(null)
  const [transactions, setTransactions] = useState<any[]>([])

  useEffect(() => {
    // Client-side auth check for dev mode without Supabase
    if (typeof window !== "undefined") {
      const checkAuth = () => {
        // Wait a moment for sessionStorage to be available after redirect
        const isAuthenticated = sessionStorage.getItem("dev_authenticated") === "true"
        
        console.log("[Vault] Auth check:", { 
          isAuthenticated,
          sessionStorageKeys: Object.keys(sessionStorage),
          dev_authenticated: sessionStorage.getItem("dev_authenticated"),
          allSessionStorage: JSON.stringify(Object.fromEntries(
            Object.keys(sessionStorage).map(key => [key, sessionStorage.getItem(key)])
          ))
        })
        
        if (!isAuthenticated) {
          console.log("[Vault] Not authenticated, redirecting to /auth")
          window.location.href = "/auth"
          return false
        }
        
        console.log("[Vault] Authenticated, showing vault")
        
        // In dev mode, use mock data since we don't have Supabase
        // You can extend this later to fetch from Supabase when configured
        setVault({
          balance: 0,
          yield_rate: 15,
          alias: "dev-vault-" + Date.now().toString().slice(-6)
        })
        setTransactions([])
        return true
      }
      
      // Give a small delay after page load to ensure sessionStorage is ready
      // This handles race conditions where sessionStorage might not be available immediately after redirect
      const timeoutId = setTimeout(() => {
        const authResult = checkAuth()
        if (!authResult) {
          // If still not authenticated after delay, try one more time
          setTimeout(() => {
            const retryResult = checkAuth()
            if (!retryResult) {
              console.error("[Vault] Authentication failed after all retries, redirecting...")
              window.location.href = "/auth"
            }
          }, 300)
        }
      }, 50)
      
      return () => clearTimeout(timeoutId)
    }
  }, [router])

  // Calculate yield earned (simplified - in production this would be calculated based on time)
  const yieldAmount = vault ? (Number(vault.balance) * Number(vault.yield_rate)) / 100 / 365 : 0

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard">← Back</Link>
            </Button>
            <h1 className="text-xl font-semibold">Your Vault</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Balance Overview */}
        <div className="mb-8 grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardDescription>Total Balance</CardDescription>
              <CardTitle className="text-4xl">${Number(vault?.balance || 0).toFixed(2)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span>Earning {vault?.yield_rate || 15}% annual yield</span>
                <span className="ml-2">≈ ${yieldAmount.toFixed(2)}/day</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Your Alias</CardDescription>
              <CardTitle className="text-2xl font-mono">{vault?.alias || "N/A"}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Use this to receive funds</p>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="mb-8 grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <ArrowDownToLine className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Deposit Funds</CardTitle>
                  <CardDescription>Add money to your vault</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/dashboard/vault/deposit">Deposit</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <ArrowUpFromLine className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Withdraw Funds</CardTitle>
                  <CardDescription>Send money via alias or QR</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full bg-transparent" variant="outline">
                <Link href="/dashboard/vault/withdraw">Withdraw</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* QR Code Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Receive via QR Code</CardTitle>
            <CardDescription>Share this QR code to receive funds</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
              <div className="flex h-48 w-48 items-center justify-center rounded-lg border-2 border-dashed bg-muted">
                <div className="text-center">
                  <Wallet className="mx-auto mb-2 h-12 w-12 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">QR Code</p>
                  <p className="text-xs text-muted-foreground">{vault?.alias}</p>
                </div>
              </div>
              <div className="flex-1 space-y-2 text-center md:text-left">
                <p className="text-sm text-muted-foreground">
                  Anyone can scan this QR code or use your alias to send you funds directly to your vault.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button variant="outline" size="sm">
                    Download QR
                  </Button>
                  <Button variant="outline" size="sm">
                    Share Alias
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Your latest vault activity</CardDescription>
          </CardHeader>
          <CardContent>
            {transactions && transactions.length > 0 ? (
              <div className="space-y-3">
                {transactions.map((transaction: any) => {
                  const isPositive =
                    transaction.type === "deposit" || transaction.type === "yield" || transaction.type === "loan"
                  const typeColors: Record<string, string> = {
                    deposit: "bg-green-500/10 text-green-500",
                    withdrawal: "bg-red-500/10 text-red-500",
                    yield: "bg-blue-500/10 text-blue-500",
                    loan: "bg-purple-500/10 text-purple-500",
                  }

                  return (
                    <div key={transaction.id} className="flex items-center justify-between rounded-lg border p-4">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-full p-2 ${typeColors[transaction.type]}`}>
                          {isPositive ? (
                            <ArrowDownToLine className="h-4 w-4" />
                          ) : (
                            <ArrowUpFromLine className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium capitalize">{transaction.type}</p>
                          {transaction.description && (
                            <p className="text-sm text-muted-foreground">{transaction.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {new Date(transaction.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${isPositive ? "text-green-500" : "text-red-500"}`}>
                          {isPositive ? "+" : "-"}${Number(transaction.amount).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                <Wallet className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
                <p>No transactions yet</p>
                <p className="mt-1 text-sm">Start by depositing funds to your vault</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
