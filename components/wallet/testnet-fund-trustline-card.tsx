"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getStellarConfig } from "@/lib/turnkey/config"
import {
  checkAccountStatus,
  getOrCreateRealWallet,
  type AccountCreationStatus,
} from "@/lib/stellar/wallet-creator"
import { getCredentialIdFromSession } from "@/lib/storage/key-utils"
import { getUserId } from "@/lib/wallet-utils"

type Props = {
  walletAddress: string
  onActivated?: () => void
}

/**
 * Testnet-only: fund the Stellar address via Friendbot and add the USDC trust line
 * (client-side signing). Shown when the on-chain account is missing or has no USDC trust line.
 */
export function TestnetFundTrustlineCard({ walletAddress, onActivated }: Props) {
  const stellarConfig = getStellarConfig()
  const [ready, setReady] = useState<boolean | null>(null)
  const [status, setStatus] = useState<AccountCreationStatus | null>(null)
  const [busy, setBusy] = useState(false)

  const refreshGate = useCallback(async () => {
    if (!walletAddress || stellarConfig.network !== "testnet") {
      setReady(true)
      return
    }
    try {
      const info = await checkAccountStatus(walletAddress)
      setReady(info.exists && info.hasUSDCTrustline)
    } catch {
      setReady(false)
    }
  }, [walletAddress, stellarConfig.network])

  useEffect(() => {
    void refreshGate()
  }, [refreshGate])

  const run = async () => {
    const credentialId = getCredentialIdFromSession()
    if (!credentialId) {
      setStatus({
        status: "error",
        message: "No hay passkey en esta sesión. Vuelve a iniciar sesión.",
        publicKey: walletAddress,
        network: "testnet",
        accountExists: false,
        trustlineExists: false,
        error: "credential_id missing",
      })
      return
    }

    setBusy(true)
    setStatus(null)
    try {
      const userId = getUserId()
      const result = await getOrCreateRealWallet(userId || undefined, {
        onStatusUpdate: (s) => setStatus(s),
      })
      setStatus(result)
      if (result.status === "complete") {
        await refreshGate()
        onActivated?.()
      }
    } catch (e) {
      setStatus({
        status: "error",
        message: e instanceof Error ? e.message : String(e),
        publicKey: walletAddress,
        network: "testnet",
        accountExists: false,
        trustlineExists: false,
        error: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setBusy(false)
    }
  }

  if (stellarConfig.network !== "testnet") return null
  if (ready === null) {
    return (
      <div className="mb-6 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
        <Loader2 className="h-4 w-4 animate-spin" />
        Comprobando cuenta en testnet…
      </div>
    )
  }
  if (ready) return null

  return (
    <div className="mb-6 rounded-xl border border-amber-400/30 bg-amber-950/20 px-4 py-4 space-y-3">
      <div className="flex items-start gap-2">
        <Sparkles className="h-5 w-5 text-amber-300 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-amber-100">Activar cuenta (testnet)</p>
          <p className="text-xs text-white/60 leading-relaxed">
            Tu dirección ya está registrada, pero falta fondeo en Stellar y/o la línea de confianza USDC.
            En testnet usamos Friendbot (XLM) y luego firmamos el trust line USDC con tu passkey.
          </p>
        </div>
      </div>

      {status && (
        <div
          className={`rounded-lg border px-3 py-2 text-xs ${
            status.status === "error"
              ? "border-red-400/40 bg-red-950/30 text-red-100"
              : status.status === "complete"
                ? "border-green-400/40 bg-green-950/30 text-green-100"
                : "border-white/15 bg-black/30 text-white/80"
          }`}
        >
          <p className="font-medium">{status.message}</p>
          {status.error ? <p className="mt-1 opacity-90">{status.error}</p> : null}
          {status.transactionHash ? (
            <a
              className="mt-2 inline-block text-blue-300 underline"
              href={`${stellarConfig.horizonUrl}/transactions/${status.transactionHash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ver transacción
            </a>
          ) : null}
        </div>
      )}

      <Button
        type="button"
        onClick={() => void run()}
        disabled={busy}
        className="w-full bg-amber-400 text-black hover:bg-amber-300 font-semibold"
      >
        {busy ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Procesando…
          </>
        ) : (
          "Fondear (Friendbot) y línea USDC"
        )}
      </Button>
    </div>
  )
}
