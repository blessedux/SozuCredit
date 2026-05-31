/**
 * Custom hook for send payment functionality
 * Handles recipient resolution, payment submission, and transaction signing
 */

import { useState, useCallback } from "react"
import { getUserId } from "@/lib/wallet-utils"
import type { PaymentReceipt } from "@/lib/payment/payment-receipt"
import {
  formatRecipientDisplayLabel,
  getSenderDisplayLabel,
} from "@/lib/payment/payment-receipt"
import {
  convertAmountForCurrencySwitch,
  defaultSendAmountCurrency,
  usdcFromInputAmount,
  type SendAmountCurrency,
} from "@/lib/payment/send-amount-currency"
import {
  LEGACY_CLASSIC_PAYMENT_NOTICE,
  paymentRailForAddress,
  recipientResolveErrorMessage,
} from "@/lib/payment/payment-rail"
import { normalizeSozuTag } from "@/lib/payment/sozu-tag-lookup"
import { isValidStellarReceiveAddress } from "@/lib/payment/stellar-address"
import type { ReferenceFiat } from "@/lib/treasury/types"

export function useSendPayment(
  walletAddress: string,
  walletNetwork: "testnet" | "mainnet",
  defindexBalance: { walletBalance: number; strategyBalance: number; totalBalance: number } | null,
  referenceFiat: ReferenceFiat,
  onSuccess?: (receipt: PaymentReceipt) => void,
  onRefresh?: () => void
) {
  const [sendRecipient, setSendRecipient] = useState("")
  const [sendAmount, setSendAmount] = useState("")
  const [amountInputCurrency, setAmountInputCurrency] = useState<SendAmountCurrency>(() =>
    defaultSendAmountCurrency(referenceFiat),
  )
  const [isSending, setIsSending] = useState(false)
  const [sendStep, setSendStep] = useState<"recipient" | "amount">("recipient")
  const [resolvedRecipientAddress, setResolvedRecipientAddress] = useState<string | null>(null)
  const [resolvedPaymentRail, setResolvedPaymentRail] = useState<"smart" | "legacy" | null>(null)
  const [legacyPaymentNotice, setLegacyPaymentNotice] = useState<string | null>(null)
  const [isResolvingRecipient, setIsResolvingRecipient] = useState(false)
  const [isManualMode, setIsManualMode] = useState(false)
  const [sendMemo, setSendMemo] = useState("")
  const [recipientError, setRecipientError] = useState<string | null>(null)
  const [isVibrating, setIsVibrating] = useState(false)

  const toggleAmountCurrency = useCallback(() => {
    const nextCurrency: SendAmountCurrency =
      amountInputCurrency === "fiat" ? "usdc" : "fiat"
    const parsed = parseFloat(sendAmount)
    if (sendAmount && !Number.isNaN(parsed) && parsed > 0) {
      setSendAmount(
        convertAmountForCurrencySwitch(
          parsed,
          amountInputCurrency,
          nextCurrency,
          referenceFiat,
        ),
      )
    }
    setAmountInputCurrency(nextCurrency)
  }, [amountInputCurrency, referenceFiat, sendAmount])

  const resetSendPayment = useCallback(() => {
    setSendStep("recipient")
    setSendRecipient("")
    setSendAmount("")
    setAmountInputCurrency(defaultSendAmountCurrency(referenceFiat))
    setResolvedRecipientAddress(null)
    setResolvedPaymentRail(null)
    setLegacyPaymentNotice(null)
    setIsManualMode(false)
    setSendMemo("")
    setRecipientError(null)
    setIsVibrating(false)
  }, [referenceFiat])

  const applyResolvedRecipient = useCallback(
    (address: string, rail?: "smart" | "legacy", notice?: string | null) => {
      const normalized = address.trim().toUpperCase()
      setResolvedRecipientAddress(normalized)
      setResolvedPaymentRail(rail ?? paymentRailForAddress(normalized))
      setLegacyPaymentNotice(notice ?? (rail === "legacy" ? LEGACY_CLASSIC_PAYMENT_NOTICE : null))
      setSendStep("amount")
      setRecipientError(null)
    },
    []
  )

  const handleResolveRecipient = useCallback(async () => {
    if (!sendRecipient.trim()) {
      return
    }

    setRecipientError(null)
    setIsResolvingRecipient(true)
    try {
      const userId = getUserId()
      if (!userId) {
        throw new Error("User not authenticated")
      }

      const trimmed = sendRecipient.trim()
      const stellarAddr = trimmed.toUpperCase()

      if (isValidStellarReceiveAddress(stellarAddr)) {
        const rail = paymentRailForAddress(stellarAddr)!
        applyResolvedRecipient(
          stellarAddr,
          rail,
          rail === "legacy" ? LEGACY_CLASSIC_PAYMENT_NOTICE : null,
        )
        return
      }

      if (isManualMode) {
        setRecipientError("Enter a Sozu tag or a Stellar address (C… smart account or G… legacy).")
        setIsVibrating(true)
        setTimeout(() => setIsVibrating(false), 500)
        return
      }

      const resolveResponse = await fetch("/api/wallet/resolve-recipient", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({
          recipient: normalizeSozuTag(trimmed) || trimmed,
        }),
      })

      if (!resolveResponse.ok) {
        const error = await resolveResponse.json().catch(() => ({}))
        setRecipientError(recipientResolveErrorMessage(error.error))
        setIsVibrating(true)
        setTimeout(() => setIsVibrating(false), 500)
        return
      }

      const data = await resolveResponse.json()
      const recipientAddress = data?.walletAddress as string | undefined
      if (!recipientAddress) {
        setRecipientError("Sozu tag not found. Check spelling or paste a C… or G… address.")
        setIsVibrating(true)
        setTimeout(() => setIsVibrating(false), 500)
        return
      }

      applyResolvedRecipient(
        recipientAddress,
        data.paymentRail === "legacy" ? "legacy" : "smart",
        typeof data.legacyNotice === "string" ? data.legacyNotice : null,
      )
    } catch (error: unknown) {
      console.error("[Resolve Recipient] Error:", error)
      setRecipientError(
        error instanceof Error ? error.message : "Could not resolve recipient",
      )
      setIsVibrating(true)
      setTimeout(() => setIsVibrating(false), 500)
    } finally {
      setIsResolvingRecipient(false)
    }
  }, [sendRecipient, isManualMode, applyResolvedRecipient])

  const handleSendPayment = useCallback(async () => {
    if (!sendAmount || parseFloat(sendAmount) <= 0 || !resolvedRecipientAddress) {
      return
    }

    const inputAmount = parseFloat(sendAmount)
    const amount = usdcFromInputAmount(inputAmount, amountInputCurrency, referenceFiat)
    if (amount <= 0) {
      return
    }
    if (!walletAddress) {
      alert("Wallet address not found. Please create a wallet first.")
      return
    }

    const userId = getUserId()
    if (!userId) {
      alert("User not authenticated. Please log in again.")
      return
    }

    console.log("[Send Payment] Fetching real-time USDC balance for verification...")
    let currentBalance = defindexBalance?.walletBalance ?? 0
    const bufferAmount = 0.01
    const requiredBalance = amount + bufferAmount

    if (!walletAddress.startsWith("C")) {
      alert(
        "Tu billetera debe ser una cuenta inteligente (C…). Cerrá sesión, volvé a entrar con passkey y completá la configuración.",
      )
      return
    }

    if (walletAddress) {
      try {
        const balanceResponse = await fetch(
          `/api/wallet/stellar/balance?publicKey=${encodeURIComponent(walletAddress)}`,
          { headers: { "x-user-id": userId } },
        )

        if (balanceResponse.ok) {
          const balanceData = (await balanceResponse.json()) as {
            usdcBalance?: number
            classicUsdcOnSigner?: number
            spendableAssetLabel?: string
          }
          if (typeof balanceData.usdcBalance === "number") {
            currentBalance = balanceData.usdcBalance
            console.log("[Send Payment] ✅ Spendable on C:", currentBalance)
          }
          if (
            currentBalance < requiredBalance &&
            typeof balanceData.classicUsdcOnSigner === "number" &&
            balanceData.classicUsdcOnSigner > 0
          ) {
            const label = balanceData.spendableAssetLabel ?? "BlendUSDC"
            alert(
              `You have ${balanceData.classicUsdcOnSigner.toFixed(2)} Circle testnet USDC on a classic G account, but sends use ${label} on your smart account (C…). Mint or move funds to your C address via testnet.blend.capital.`,
            )
            return
          }
        }
      } catch (balanceError) {
        console.warn("[Send Payment] Could not fetch real-time balance, using cached:", balanceError)
      }
    }

    if (currentBalance < requiredBalance) {
      const strategyBalance = defindexBalance?.strategyBalance || 0
      let errorMessage = `Insufficient balance. You need ${requiredBalance.toFixed(2)} USDC (including ${bufferAmount.toFixed(2)} USDC buffer) but only have ${currentBalance.toFixed(2)} USDC available in your wallet.`
      if (strategyBalance > 0) {
        errorMessage += `\n\nYou have ${strategyBalance.toFixed(2)} USDC locked in DeFindex strategy. Withdraw from DeFindex first.`
      }
      alert(errorMessage)
      return
    }

    setIsSending(true)
    try {
      let passkeySignerG: string | undefined
      try {
        const { getCurrentCredentialId } = await import("@/lib/storage/key-utils")
        const { deriveAndStoreKey } = await import("@/lib/storage/browser-keys")
        const credId = await getCurrentCredentialId(walletAddress)
        if (credId) {
          const { publicKey } = await deriveAndStoreKey(credId, userId)
          const g = publicKey.trim().toUpperCase()
          if (g.startsWith("G") && g.length === 56) passkeySignerG = g
        }
      } catch {
        // Server may still have signer_public_key on file
      }

      const buildResponse = await fetch("/api/wallet/stellar/payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({
          destination: resolvedRecipientAddress,
          amount: amount.toString(),
          sender: walletAddress,
          ...(passkeySignerG ? { signer: passkeySignerG } : {}),
          memo: sendMemo.trim() || undefined,
        }),
      })

      if (!buildResponse.ok) {
        const error = await buildResponse.json()
        throw new Error(error.error || "Failed to build payment transaction")
      }

      const build = await buildResponse.json()
      const signMethod = build.signMethod as string | undefined

      let submitBody: { signedTransactionXdr?: string; signedEnvelopeXdr?: string }

      const ozUnsignedXdr =
        typeof build.unsignedXdr === "string"
          ? build.unsignedXdr
          : typeof build.envelopeXdr === "string"
            ? build.envelopeXdr
            : null

      if (signMethod === "oz_passkey" && ozUnsignedXdr) {
        const { getSmartAccountKit } = await import("@/lib/stellar/smartAccounts/client")
        const { signSorobanPreparedTxWithPasskey } = await import(
          "@/lib/stellar/smartAccounts/signSorobanUsdc"
        )
        const { getCurrentCredentialId } = await import("@/lib/storage/key-utils")
        const { kit, config } = await getSmartAccountKit()
        const credentialId =
          (typeof build.ozCredentialId === "string" ? build.ozCredentialId : null) ||
          (await getCurrentCredentialId(
            typeof build.signerPublicKey === "string" ? build.signerPublicKey : walletAddress,
          ))
        if (!credentialId) {
          throw new Error("Credential ID not found. Please log in again.")
        }
        const signedEnvelopeXdr = await signSorobanPreparedTxWithPasskey({
          kit,
          unsignedXdr: ozUnsignedXdr,
          networkPassphrase: config.networkPassphrase,
          credentialId,
        })
        submitBody = { signedEnvelopeXdr }
      } else {
        const unsignedXdr = build.unsignedXdr
        if (!unsignedXdr) {
          throw new Error("No unsigned transaction returned")
        }

        const signerPublicKey =
          typeof build.signerPublicKey === "string" ? build.signerPublicKey : walletAddress

        if (build.paymentRail === "legacy" && build.legacyNotice) {
          console.log("[Send Payment] Legacy classic payment:", build.legacyNotice)
        }

        const stellarSdk = await import("@stellar/stellar-sdk")
        const { getStellarConfig } = await import("@/lib/turnkey/config")
        const stellarConfig = getStellarConfig()
        const networkPassphrase =
          stellarConfig.network === "mainnet"
            ? stellarSdk.Networks.PUBLIC
            : stellarSdk.Networks.TESTNET
        const transactionXdr = stellarSdk.TransactionBuilder.fromXDR(unsignedXdr, networkPassphrase)
        if (transactionXdr instanceof stellarSdk.FeeBumpTransaction) {
          throw new Error("Fee bump transactions are not supported")
        }
        const transaction = transactionXdr

        if (transaction.source !== signerPublicKey) {
          throw new Error(
            `Transaction source mismatch. Expected signer ${signerPublicKey.substring(0, 8)}…, got ${transaction.source.substring(0, 8)}…`,
          )
        }

        const { getCurrentCredentialId } = await import("@/lib/storage/key-utils")
        const { signTransactionWithPasskeyApproval } = await import("@/lib/stellar/client-signing")

        const lookupKey = signerPublicKey.startsWith("G") ? signerPublicKey : walletAddress
        const credentialId = await getCurrentCredentialId(lookupKey)
        if (!credentialId) {
          throw new Error("Credential ID not found. Please log in again.")
        }

        const signedResult = await signTransactionWithPasskeyApproval(
          transaction,
          credentialId,
          signerPublicKey,
          userId,
        )

        if (!signedResult?.transaction) {
          throw new Error("Transaction signing failed - no signed transaction returned.")
        }

        submitBody = { signedTransactionXdr: signedResult.transactionXdr }
      }

      const submitResponse = await fetch("/api/wallet/stellar/payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify(submitBody),
      })

      if (!submitResponse.ok) {
        const error = await submitResponse.json()
        throw new Error(error.error || "Failed to submit payment")
      }

      const result = await submitResponse.json()

      if (
        result.success === true &&
        result.transactionHash &&
        typeof result.transactionHash === "string" &&
        result.transactionHash.length > 0
      ) {
        if (!result.confirmed) {
          await new Promise((resolve) => setTimeout(resolve, 2000))
        }

        if (onRefresh) {
          onRefresh()
          setTimeout(() => onRefresh(), 3000)
        }

        if (onSuccess) {
          onSuccess({
            amount,
            currency: "USDC",
            fromLabel: getSenderDisplayLabel(),
            toLabel: formatRecipientDisplayLabel(sendRecipient, resolvedRecipientAddress),
            toAddress: resolvedRecipientAddress ?? undefined,
            transactionHash: result.transactionHash,
            network: walletNetwork,
            memo: sendMemo.trim() || null,
            completedAt: new Date().toISOString(),
          })
        }

        resetSendPayment()
      } else {
        throw new Error(result.error || "Payment failed. Transaction was not submitted successfully.")
      }
    } catch (error: unknown) {
      console.error("[Send Payment] Error:", error)
      let errorMessage = error instanceof Error ? error.message : "Unknown error"
      if (errorMessage.includes("account not found")) {
        errorMessage =
          "Your wallet is not active on the network yet. Fund your smart account or classic wallet with XLM/USDC."
      }
      alert(`❌ ${errorMessage}`)
    } finally {
      setIsSending(false)
    }
  }, [
    sendAmount,
    amountInputCurrency,
    referenceFiat,
    sendRecipient,
    resolvedRecipientAddress,
    walletAddress,
    walletNetwork,
    defindexBalance,
    sendMemo,
    onSuccess,
    onRefresh,
    resetSendPayment,
  ])

  return {
    sendRecipient,
    sendAmount,
    amountInputCurrency,
    isSending,
    sendStep,
    resolvedRecipientAddress,
    resolvedPaymentRail,
    legacyPaymentNotice,
    isResolvingRecipient,
    isManualMode,
    sendMemo,
    recipientError,
    isVibrating,
    setSendRecipient,
    setSendAmount,
    setIsManualMode,
    setSendMemo,
    setRecipientError,
    toggleAmountCurrency,
    handleResolveRecipient,
    handleSendPayment,
    resetSendPayment,
  }
}
