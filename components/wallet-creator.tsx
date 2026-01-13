/**
 * Cypherpunk Wallet Creator Component
 * 
 * Phase 3: User-friendly UI for creating real Stellar accounts with USDC trustline
 * 
 * Features:
 * - Real-time status updates
 * - Funding instructions for mainnet
 * - QR code for easy funding
 * - Error handling and recovery
 * - Key management features
 */

"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle2, XCircle, Copy, ExternalLink, Key, Wallet } from "lucide-react"
import {
  createRealStellarAccount,
  getOrCreateRealWallet,
  checkAccountStatus,
  AccountCreationStatus,
  USDC_ISSUERS,
  MINIMUM_XLM_REQUIREMENTS,
} from "@/lib/stellar/wallet-creator"
import { getCredentialIdFromSession, getPublicKeyFromSession } from "@/lib/storage/key-utils"
import { getStellarConfig } from "@/lib/turnkey/config"
// QR Code is optional - can be added later if needed
// import QRCode from "qrcode.react"

interface WalletCreatorProps {
  onWalletCreated?: (publicKey: string, network: "testnet" | "mainnet") => void
  compact?: boolean // For use in profile sheet
}

export function WalletCreator({ onWalletCreated, compact = false }: WalletCreatorProps = {}) {
  const [status, setStatus] = useState<AccountCreationStatus | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [accountInfo, setAccountInfo] = useState<{
    exists: boolean
    network: "testnet" | "mainnet"
    balances: Array<{ asset: string; balance: string }>
    hasUSDCTrustline: boolean
    usdcIssuer?: string
  } | null>(null)
  const [copied, setCopied] = useState(false)

  const credentialId = getCredentialIdFromSession()
  const publicKey = getPublicKeyFromSession()
  const userId = typeof window !== "undefined" ? sessionStorage.getItem("dev_username") : null
  const stellarConfig = getStellarConfig()

  // Check account status on mount
  useEffect(() => {
    if (publicKey) {
      checkAccountStatus(publicKey)
        .then(setAccountInfo)
        .catch((error) => {
          console.error("[Wallet Creator] Error checking account status:", error)
        })
    }
  }, [publicKey])

  const handleCreateWallet = async () => {
    if (!credentialId) {
      setStatus({
        status: "error",
        message: "No credential ID found. Please authenticate with a passkey first.",
        publicKey: "",
        network: stellarConfig.network,
        accountExists: false,
        trustlineExists: false,
        error: "No credential ID found",
      })
      return
    }

    setIsCreating(true)
    setStatus(null)

    try {
      const result = await getOrCreateRealWallet(userId || undefined, {
        onStatusUpdate: (newStatus) => {
          setStatus(newStatus)
        },
      })

      setStatus(result)

      // Refresh account info after creation
      if (result.publicKey) {
        const info = await checkAccountStatus(result.publicKey)
        setAccountInfo(info)
        
        // Notify parent component that wallet was created
        if (onWalletCreated) {
          onWalletCreated(result.publicKey, result.network)
        }
      }
    } catch (error) {
      setStatus({
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error occurred",
        publicKey: publicKey || "",
        network: stellarConfig.network,
        accountExists: false,
        trustlineExists: false,
        error: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setIsCreating(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getStatusIcon = () => {
    if (!status) return null

    switch (status.status) {
      case "complete":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case "error":
        return <XCircle className="h-5 w-5 text-red-500" />
      case "checking":
      case "funding":
      case "creating":
      case "trustline":
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
      default:
        return null
    }
  }

  const getStatusColor = () => {
    if (!status) return "bg-gray-100"

    switch (status.status) {
      case "complete":
        return "bg-green-50 border-green-200"
      case "error":
        return "bg-red-50 border-red-200"
      case "checking":
      case "funding":
      case "creating":
      case "trustline":
        return "bg-blue-50 border-blue-200"
      default:
        return "bg-gray-50 border-gray-200"
    }
  }

  if (compact) {
    // Compact version for profile sheet
    return (
      <div className="space-y-3">
        {status && (
          <div className={`p-3 rounded-lg border ${
            status.status === "complete" ? "bg-green-50 border-green-200 text-green-800" :
            status.status === "error" ? "bg-red-50 border-red-200 text-red-800" :
            "bg-blue-50 border-blue-200 text-blue-800"
          }`}>
            <div className="flex items-start gap-2">
              {status.status === "complete" && <CheckCircle2 className="h-4 w-4 mt-0.5" />}
              {status.status === "error" && <XCircle className="h-4 w-4 mt-0.5" />}
              {(status.status === "checking" || status.status === "funding" || status.status === "creating" || status.status === "trustline") && <Loader2 className="h-4 w-4 animate-spin mt-0.5" />}
              <div className="flex-1">
                <p className="text-xs font-medium">{status.message}</p>
                {status.error && <p className="text-xs mt-1 opacity-80">{status.error}</p>}
              </div>
            </div>
          </div>
        )}
        
        {publicKey && (
          <div className="text-xs text-white/60">
            <code className="text-xs">{publicKey.substring(0, 12)}...{publicKey.substring(publicKey.length - 8)}</code>
          </div>
        )}

        <Button
          onClick={handleCreateWallet}
          disabled={isCreating || !credentialId}
          className="w-full"
          size="sm"
        >
          {isCreating ? (
            <>
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Wallet className="mr-2 h-3 w-3" />
              Create Wallet
            </>
          )}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Cypherpunk Non-Custodial Wallet
          </CardTitle>
          <CardDescription>
            Create a real Stellar account with USDC trustline. Fully decentralized, client-side, no server dependencies.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Status */}
          {status && (
            <Alert className={getStatusColor()}>
              <div className="flex items-start gap-3">
                {getStatusIcon()}
                <div className="flex-1">
                  <AlertTitle className="mb-1">{status.message}</AlertTitle>
                  {status.error && (
                    <AlertDescription className="text-red-600">{status.error}</AlertDescription>
                  )}
                  {status.transactionHash && (
                    <AlertDescription className="mt-2">
                      <a
                        href={`${stellarConfig.horizonUrl}/transactions/${status.transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1"
                      >
                        View Transaction <ExternalLink className="h-3 w-3" />
                      </a>
                    </AlertDescription>
                  )}
                </div>
              </div>
            </Alert>
          )}

          {/* Account Info */}
          {accountInfo && accountInfo.exists && (
            <Card className="bg-gray-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Account Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Network:</span>
                  <Badge variant={accountInfo.network === "mainnet" ? "default" : "secondary"}>
                    {accountInfo.network}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">USDC Trustline:</span>
                  {accountInfo.hasUSDCTrustline ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                      Not Created
                    </Badge>
                  )}
                </div>
                {accountInfo.balances.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-sm font-medium mb-2">Balances:</p>
                    {accountInfo.balances.map((bal, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span>{bal.asset}:</span>
                        <span className="font-mono">{bal.balance}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Public Key Display */}
          {publicKey && (
            <Card className="bg-gray-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Your Stellar Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm bg-white p-2 rounded border break-all">
                    {publicKey}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(publicKey)}
                  >
                    {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  This is your non-custodial wallet address. Keys are stored only in your browser.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Funding Instructions for Mainnet */}
          {status?.fundingRequired && status.fundingAddress && (
            <Card className="bg-yellow-50 border-yellow-200">
              <CardHeader>
                <CardTitle className="text-sm">Funding Required (Mainnet)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700">
                  To create your account on mainnet, send at least{" "}
                  <strong>{status.fundingAmount} XLM</strong> to this address:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm bg-white p-2 rounded border break-all">
                    {status.fundingAddress}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(status.fundingAddress!)}
                  >
                    {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                {/* QR Code can be added here if qrcode.react is installed */}
                {/* <div className="flex justify-center p-4 bg-white rounded">
                  <QRCode value={status.fundingAddress} size={200} />
                </div> */}
                <p className="text-xs text-gray-500">
                  After funding, click "Create Wallet" again to complete account setup.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Create Wallet Button */}
          <div className="flex gap-2">
            <Button
              onClick={handleCreateWallet}
              disabled={isCreating || !credentialId}
              className="flex-1"
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Wallet...
                </>
              ) : (
                <>
                  <Wallet className="mr-2 h-4 w-4" />
                  {accountInfo?.exists ? "Update Wallet" : "Create Wallet"}
                </>
              )}
            </Button>
            {publicKey && (
              <Button
                variant="outline"
                onClick={() => {
                  const url = `${stellarConfig.horizonUrl}/accounts/${publicKey}`
                  window.open(url, "_blank")
                }}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Network Info */}
          <div className="text-xs text-gray-500 text-center">
            Network: <strong>{stellarConfig.network}</strong> | USDC Issuer:{" "}
            <code className="text-xs">
              {USDC_ISSUERS[stellarConfig.network].substring(0, 20)}...
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
