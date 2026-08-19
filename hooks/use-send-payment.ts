/**
 * Custom hook for send payment functionality
 * Handles recipient resolution, payment submission, and transaction signing
 */

import { useState, useCallback, useRef, useEffect } from "react"
import { iosHapticSingle } from "@/lib/haptics/ios-switch-pulse"
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
import {
  canCoverSendAmount,
  maxSingleTokenBalance,
  type BalancePayloadForSend,
} from "@/lib/stellar/spendable-balance-client"
import { isPizzaAssetRow, parseWholeTokenAmount } from "@/lib/stellar/sku-send"
import { PIZZA_SYMBOL } from "@/lib/stellar/pizza-token"

/** Warm kit + on-chain connect so Send can open the passkey prompt immediately on tap. */
async function warmKitForSend(contractId: string, credentialId: string): Promise<void> {
  const c = contractId.trim().toUpperCase()
  const cred = credentialId.trim()
  if (!c.startsWith("C") || !cred) return
  try {
    const { getSmartAccountKit } = await import("@/lib/stellar/smartAccounts/client")
    const { ensureKitConnectedForSend } = await import("@/lib/stellar/smartAccounts/ensureKitConnected")
    const { kit } = await getSmartAccountKit()
    await ensureKitConnectedForSend(kit, cred, c)
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[Send Payment] Kit warm-up skipped:", err)
    }
  }
}

export function useSendPayment(
  walletAddress: string,
  walletNetwork: "testnet" | "mainnet",
  defindexBalance: {
    walletBalance: number
    sorobanSacBalance?: number
    spendableOnC?: number
    strategyBalance: number
    totalBalance: number
    displayBalance?: number
    tokenBalances?: Array<{
      assetId?: string
      contractId: string
      symbol?: string
      displayName?: string
      balance: number
      category?: string
      decimals?: number
      sendPriority?: number
    }>
  } | null,
  referenceFiat: ReferenceFiat,
  onSuccess?: (receipt: PaymentReceipt) => void,
  onRefresh?: () => void | Promise<void>,
  insufficientBalanceLabel = "Amount exceeds available balance",
) {
  const [sendRecipient, setSendRecipient] = useState("")
  const [sendAmount, setSendAmount] = useState("")
  const [amountInputCurrency, setAmountInputCurrency] = useState<SendAmountCurrency>(() =>
    defaultSendAmountCurrency(referenceFiat),
  )
  const [isSending, setIsSending] = useState(false)
  const [sendPhase, setSendPhase] = useState<"preparing" | "signing" | "submitting" | null>(null)
  const [sendStep, setSendStep] = useState<"recipient" | "amount">("recipient")
  const [resolvedRecipientAddress, setResolvedRecipientAddress] = useState<string | null>(null)
  const [resolvedPaymentRail, setResolvedPaymentRail] = useState<"smart" | "legacy" | null>(null)
  const [legacyPaymentNotice, setLegacyPaymentNotice] = useState<string | null>(null)
  const [isResolvingRecipient, setIsResolvingRecipient] = useState(false)
  const [isManualMode, setIsManualMode] = useState(false)
  const [sendMemo, setSendMemo] = useState("")
  const [recipientError, setRecipientError] = useState<string | null>(null)
  const [amountError, setAmountError] = useState<string | null>(null)
  const [isVibrating, setIsVibrating] = useState(false)
  const [sendAssetContractId, setSendAssetContractId] = useState<string | null>(null)

  /** Tag → address from live validation; avoids a second resolve on Continue. */
  const recipientResolveCacheRef = useRef<{
    forTag: string
    address: string
    rail?: "smart" | "legacy"
    notice?: string | null
  } | null>(null)

  /** Cached result from background payment build (invalidated on amount/recipient change). */
  const prefetchedBuildRef = useRef<{
    unsignedXdr: string
    sorobanDataXdr?: string
    signMethod: string
    ozCredentialId?: string
    signerPublicKey?: string
    walletAddress?: string
    supportsOzKitApi?: boolean
    forAmount: number
    forRecipient: string
    forSender: string
    forContractId?: string
  } | null>(null)

  const PAYMENT_ERROR_SHAKE_MS = 500

  const triggerPaymentErrorFeedback = useCallback(() => {
    setIsVibrating(true)
    iosHapticSingle()
    setTimeout(() => setIsVibrating(false), PAYMENT_ERROR_SHAKE_MS)
  }, [])

  const pizzaRow = defindexBalance?.tokenBalances?.find((r) => isPizzaAssetRow(r))
  const isPizzaSend = Boolean(
    sendAssetContractId &&
      pizzaRow &&
      pizzaRow.contractId.toUpperCase() === sendAssetContractId.trim().toUpperCase(),
  )

  const buildCachedBalancePayload = useCallback((): BalancePayloadForSend => {
    const cachedWalletUsdc =
      defindexBalance?.spendableOnC ??
      (defindexBalance?.walletBalance ?? 0) + (defindexBalance?.sorobanSacBalance ?? 0)

    return {
      usdcBalance: cachedWalletUsdc,
      sorobanUsdcBalance: defindexBalance?.walletBalance,
      sorobanSacUsdcBalance: defindexBalance?.sorobanSacBalance,
      tokenBalances: (defindexBalance?.tokenBalances ?? []).map((r) => ({
        assetId: r.assetId,
        contractId: r.contractId,
        symbol: r.symbol,
        displayName: r.displayName ?? r.symbol ?? r.contractId.slice(0, 8),
        decimals: r.decimals,
        balance: r.balance,
        category: r.category,
        sendPriority: r.sendPriority,
      })),
    }
  }, [defindexBalance])

  const rejectInsufficientAmount = useCallback(() => {
    setAmountError(insufficientBalanceLabel)
    triggerPaymentErrorFeedback()
  }, [insufficientBalanceLabel, triggerPaymentErrorFeedback])

  /**
   * Background prefetch: when amount + recipient are valid, build the unsigned Soroban tx
   * so that on Send tap we can go straight to the passkey prompt.
   */
  useEffect(() => {
    const amount = parseFloat(sendAmount)
    if (!sendAmount || amount <= 0 || !resolvedRecipientAddress || !walletAddress.startsWith("C")) {
      prefetchedBuildRef.current = null
      return
    }
    const userId = getUserId()
    if (!userId) return

    const ctrl = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const { alignWalletForSendFast } = await import("@/lib/wallet/align-send-wallet")
        const aligned = await alignWalletForSendFast(userId, walletAddress.trim().toUpperCase()).catch(() => null)
        const senderC = aligned?.contractId ?? walletAddress.trim().toUpperCase()
        const passkeySignerG = aligned?.signerG
        const sessionCredentialId = aligned?.credentialId

        const res = await fetch("/api/wallet/stellar/payment", {
          method: "POST",
          signal: ctrl.signal,
          headers: { "Content-Type": "application/json", "x-user-id": userId },
          body: JSON.stringify({
            destination: resolvedRecipientAddress,
            amount: amount.toString(),
            sender: senderC,
            ...(passkeySignerG ? { signer: passkeySignerG } : {}),
            ...(sendAssetContractId ? { contractId: sendAssetContractId } : {}),
          }),
        })
        if (!res.ok || ctrl.signal.aborted) return
        const build = await res.json()
        if (ctrl.signal.aborted) return
        const unsignedXdr = typeof build.unsignedXdr === "string" ? build.unsignedXdr
          : typeof build.envelopeXdr === "string" ? build.envelopeXdr : null
        if (!unsignedXdr) return

        prefetchedBuildRef.current = {
          unsignedXdr,
          sorobanDataXdr: build.sorobanDataXdr ?? undefined,
          signMethod: build.signMethod,
          ozCredentialId: build.ozCredentialId ?? undefined,
          signerPublicKey: build.signerPublicKey ?? passkeySignerG ?? undefined,
          walletAddress: build.walletAddress ?? senderC,
          supportsOzKitApi: build.supportsOzKitApi,
          forAmount: amount,
          forRecipient: resolvedRecipientAddress,
          forSender: senderC,
          forContractId: sendAssetContractId ?? undefined,
        }
        if (sessionCredentialId) {
          const { storeCredentialIdInSession } = await import("@/lib/storage/key-utils")
          storeCredentialIdInSession(sessionCredentialId)
          void warmKitForSend(senderC, sessionCredentialId)
        }
      } catch {
        /* background prefetch errors are silent */
      }
    }, 150)

    return () => {
      ctrl.abort()
      window.clearTimeout(timer)
      prefetchedBuildRef.current = null
    }
  }, [sendAmount, resolvedRecipientAddress, walletAddress, sendAssetContractId])

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
    setSendPhase(null)
    setSendAssetContractId(null)
    prefetchedBuildRef.current = null
    recipientResolveCacheRef.current = null
    setAmountError(null)
    setIsVibrating(false)
  }, [referenceFiat])

  /** Back to recipient step without closing the modal. */
  const goBackToRecipient = useCallback(() => {
    setSendStep("recipient")
    setResolvedRecipientAddress(null)
    setResolvedPaymentRail(null)
    setLegacyPaymentNotice(null)
    setRecipientError(null)
    setAmountError(null)
    setSendPhase(null)
    // Keep `sendRecipient` + `sendAmount` so user can quickly adjust.
    prefetchedBuildRef.current = null
  }, [])

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

  const cacheRecipientResolution = useCallback(
    (
      tag: string,
      address: string,
      rail?: "smart" | "legacy",
      notice?: string | null,
    ) => {
      const key = (normalizeSozuTag(tag) || tag.trim()).toLowerCase()
      recipientResolveCacheRef.current = { forTag: key, address, rail, notice }
    },
    [],
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
        triggerPaymentErrorFeedback()
        return
      }

      const tagKey = (normalizeSozuTag(trimmed) || trimmed).toLowerCase()
      const cached = recipientResolveCacheRef.current
      if (cached && cached.forTag === tagKey) {
        applyResolvedRecipient(cached.address, cached.rail, cached.notice)
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
        triggerPaymentErrorFeedback()
        return
      }

      const data = await resolveResponse.json()
      const recipientAddress = data?.walletAddress as string | undefined
      if (!recipientAddress) {
        setRecipientError("Sozu tag not found. Check spelling or paste a C… or G… address.")
        triggerPaymentErrorFeedback()
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
      triggerPaymentErrorFeedback()
    } finally {
      setIsResolvingRecipient(false)
    }
  }, [sendRecipient, isManualMode, applyResolvedRecipient, triggerPaymentErrorFeedback])

  const handleSendPayment = useCallback(async () => {
    if (!sendAmount || parseFloat(sendAmount) <= 0 || !resolvedRecipientAddress) {
      return
    }

    const inputAmount = parseFloat(sendAmount)
    const amount = isPizzaSend
      ? parseWholeTokenAmount(sendAmount)
      : usdcFromInputAmount(inputAmount, amountInputCurrency, referenceFiat)
    if (amount == null || amount <= 0) {
      return
    }
    if (!walletAddress) {
      alert("Wallet address not found. Please create a wallet first.")
      return
    }
    if (!walletAddress.startsWith("C")) {
      alert(
        "Tu billetera debe ser una cuenta inteligente (C…). Cerrá sesión, volvé a entrar con passkey y completá la configuración.",
      )
      return
    }

    const userId = getUserId()
    if (!userId) {
      alert("User not authenticated. Please log in again.")
      return
    }

    // Full balance sends are allowed — Soroban fees are paid in XLM, not USDC.
    const requiredBalance = amount
    const preferredContractId = sendAssetContractId?.trim().toUpperCase() || undefined

    setAmountError(null)

    const coverCached = canCoverSendAmount(
      buildCachedBalancePayload(),
      requiredBalance,
      preferredContractId,
    )
    if (!coverCached.ok) {
      rejectInsufficientAmount()
      return
    }

    // Show spinner immediately — before any async work.
    setIsSending(true)

    // Check whether the prefetched build is still valid for this send.
    const prefetch = prefetchedBuildRef.current
    const prefetchHit =
      prefetch &&
      Math.abs(prefetch.forAmount - amount) < 0.000001 &&
      prefetch.forRecipient === resolvedRecipientAddress &&
      (prefetch.forContractId ?? undefined) === preferredContractId

    // Prefetch hit → jump straight to signing UI so the passkey prompt opens on the user gesture.
    setSendPhase(prefetchHit ? "signing" : "preparing")

    try {
      let senderC = walletAddress.trim().toUpperCase()
      let passkeySignerG: string | undefined
      let sessionCredentialId: string | undefined

      if (prefetchHit && prefetch) {
        // Fast path: wallet already aligned during prefetch.
        senderC = prefetch.walletAddress?.startsWith("C") ? prefetch.walletAddress : senderC
        passkeySignerG = prefetch.signerPublicKey?.startsWith("G") ? prefetch.signerPublicKey : undefined
        if (prefetch.ozCredentialId) sessionCredentialId = prefetch.ozCredentialId
      } else {
        // Slow path: align wallet now (with fast cached variant).
        try {
          const { alignWalletForSendFast } = await import("@/lib/wallet/align-send-wallet")
          const aligned = await alignWalletForSendFast(userId, senderC)
          senderC = aligned.contractId
          passkeySignerG = aligned.signerG
          sessionCredentialId = aligned.credentialId
          if (aligned.realigned && typeof window !== "undefined") {
            localStorage.setItem("stellar_public_key", senderC)
            sessionStorage.setItem("stellar_public_key", senderC)
          }
        } catch (alignErr) {
          console.warn("[Send Payment] Wallet align skipped:", alignErr)
          try {
            const { getCurrentCredentialId } = await import("@/lib/storage/key-utils")
            const { deriveAndStoreKey } = await import("@/lib/storage/browser-keys")
            const credId = await getCurrentCredentialId(undefined)
            if (credId) {
              sessionCredentialId = credId
              const { publicKey } = await deriveAndStoreKey(credId, userId)
              const g = publicKey.trim().toUpperCase()
              if (g.startsWith("G") && g.length === 56) passkeySignerG = g
            }
          } catch {
            /* server will supply signer_public_key */
          }
        }
      }

      if (sessionCredentialId && senderC.startsWith("C") && !prefetchHit) {
        await warmKitForSend(senderC, sessionCredentialId)
      }

      const signAndSubmit = async (): Promise<{
        signedTransactionXdr?: string
        signedEnvelopeXdr?: string
      }> => {
        let build: Record<string, unknown>

        if (prefetchHit && prefetch) {
          build = {
            unsignedXdr: prefetch.unsignedXdr,
            sorobanDataXdr: prefetch.sorobanDataXdr,
            signMethod: prefetch.signMethod,
            ozCredentialId: prefetch.ozCredentialId,
            signerPublicKey: prefetch.signerPublicKey,
            walletAddress: prefetch.walletAddress,
            supportsOzKitApi: prefetch.supportsOzKitApi,
          }
        } else {
          const buildResponse = await fetch("/api/wallet/stellar/payment", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-id": userId },
            body: JSON.stringify({
              destination: resolvedRecipientAddress,
              amount: amount.toString(),
              sender: senderC,
              ...(passkeySignerG ? { signer: passkeySignerG } : {}),
              ...(preferredContractId ? { contractId: preferredContractId } : {}),
              memo: sendMemo.trim() || undefined,
            }),
          })

          if (!buildResponse.ok) {
            const error = (await buildResponse.json().catch(() => ({}))) as {
              error?: string
              code?: string
            }
            if (error.code === "PASSKEY_NOT_ON_SMART_ACCOUNT") {
              throw new Error(
                `${error.error ?? "Passkey not on smart account."} Use the same browser URL you used at login (e.g. always http://localhost:3001). Sign out, sign in, then retry.`,
              )
            }
            throw new Error(error.error || "Failed to build payment transaction")
          }

          build = await buildResponse.json()
        }

        const signMethod = build.signMethod as string | undefined

        const unsignedXdr =
          typeof build.unsignedXdr === "string"
            ? build.unsignedXdr
            : typeof build.envelopeXdr === "string"
              ? build.envelopeXdr
              : null

        if (!unsignedXdr) {
          throw new Error("No unsigned transaction returned")
        }

        const signerPublicKey =
          typeof build.signerPublicKey === "string" && (build.signerPublicKey as string).startsWith("G")
            ? (build.signerPublicKey as string)
            : passkeySignerG ?? null

        if (!signerPublicKey) {
          throw new Error(
            "Smart wallet signer (G…) missing. Sign out, sign in with passkey again, then retry.",
          )
        }

        const { getCurrentCredentialId, storeCredentialIdInSession } = await import(
          "@/lib/storage/key-utils"
        )
        const credentialId =
          (typeof build.ozCredentialId === "string" ? build.ozCredentialId : null) ||
          sessionCredentialId ||
          (await getCurrentCredentialId(signerPublicKey))
        if (!credentialId) {
          throw new Error("Credential ID not found. Please log in again.")
        }
        storeCredentialIdInSession(credentialId)

        const walletContractId =
          typeof build.walletAddress === "string" && (build.walletAddress as string).startsWith("C")
            ? (build.walletAddress as string).trim().toUpperCase()
            : senderC

        const { getStellarConfig } = await import("@/lib/turnkey/config")
        const stellarConfig = getStellarConfig()
        const { Networks } = await import("@stellar/stellar-sdk")
        const networkPassphrase =
          stellarConfig.network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET

        if (!prefetchHit) {
          setSendPhase("signing")
        }

        if (signMethod === "oz_passkey" || signMethod === "oz_passkey_local") {
          const { getSmartAccountKit } = await import("@/lib/stellar/smartAccounts/client")
          const { signSorobanPreparedTxWithPasskey } = await import(
            "@/lib/stellar/smartAccounts/signSorobanUsdc"
          )
          const { extractSorobanDataXdr } = await import("@/lib/stellar/soroban-prepared-envelope")
          const { kit, config } = await getSmartAccountKit()
          const sorobanDataXdr =
            typeof build.sorobanDataXdr === "string" && (build.sorobanDataXdr as string).length > 0
              ? (build.sorobanDataXdr as string)
              : extractSorobanDataXdr(unsignedXdr, config.networkPassphrase)
          const signedEnvelopeXdr = await signSorobanPreparedTxWithPasskey({
            kit,
            unsignedXdr,
            sorobanDataXdr,
            networkPassphrase: config.networkPassphrase,
            credentialId,
            smartAccountContractId: walletContractId,
            webauthnVerifierAddress: config.webauthnVerifierAddress,
            supportsOzKitApi: build.supportsOzKitApi === true,
            signMethod: signMethod ?? "oz_passkey",
          })
          return { signedEnvelopeXdr }
        }
        if (signMethod === "smart_g_signer") {
          const { signSorobanUsdcWithGSigner } = await import(
            "@/lib/stellar/smartAccounts/signSorobanTransferG"
          )
          const signedEnvelopeXdr = await signSorobanUsdcWithGSigner({
            unsignedXdr,
            signerPublicKey,
            credentialId,
            userId,
            networkPassphrase,
          })
          return { signedEnvelopeXdr }
        }
        throw new Error(`Unsupported sign method: ${signMethod ?? "unknown"}`)
      }

      const submitBody = await signAndSubmit()
      setSendPhase("submitting")

    const submitResponse = await fetch("/api/wallet/stellar/payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify(submitBody),
      })

      if (!submitResponse.ok) {
        const submitErr = await submitResponse.json().catch(() => ({})) as { error?: string; code?: string }
        const code = submitErr.code ?? ""
        console.error("[Send Payment] Submit failed", { code, error: submitErr.error })
        let userMsg = submitErr.error || "Failed to submit payment"
        if (code === "SOROBAN_SIM_AUTH_FAILED") {
          userMsg =
            "The smart account rejected this passkey signature on-chain (__check_auth). Refresh the page, try Send again once, and use only http://localhost:3001. If it persists, sign out and create a new wallet at that same URL."
        } else if (code === "TX_MALFORMED") {
          userMsg = "Transaction structure error. Please refresh the page and try again."
        } else if (code === "PASSKEY_NOT_ON_SMART_ACCOUNT") {
          userMsg = "Your passkey doesn't match the one registered on this smart account — it may have been registered on a different device or URL. Sign out completely, then sign in again at this same URL to set up a fresh wallet."
        } else if (code === "SOROBAN_LEDGER_FAILED" || code === "SOROBAN_RESOURCE_LIMIT") {
          userMsg =
            submitErr.error ??
            "The transaction was submitted but failed on-chain. Your balance was not reduced — refresh and try Send again."
        } else if (code === "PASSKEY_PROMPT_FAILED") {
          userMsg = submitErr.error ?? "Passkey was cancelled or timed out. Close any other passkey dialog and tap Send again."
        }
        throw new Error(userMsg)
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
          await Promise.resolve(onRefresh())
        }

        if (onSuccess) {
          onSuccess({
            amount,
            currency: isPizzaSend ? PIZZA_SYMBOL : "USDC",
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
      setSendPhase(null)
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
    sendAssetContractId,
    isPizzaSend,
    onSuccess,
    onRefresh,
    resetSendPayment,
    buildCachedBalancePayload,
    rejectInsufficientAmount,
  ])

  return {
    sendRecipient,
    sendAmount,
    amountInputCurrency,
    isSending,
    sendPhase,
    sendStep,
    resolvedRecipientAddress,
    resolvedPaymentRail,
    legacyPaymentNotice,
    isResolvingRecipient,
    isManualMode,
    sendMemo,
    recipientError,
    amountError,
    isVibrating,
    sendAssetContractId,
    isPizzaSend,
    setSendRecipient,
    setSendAmount,
    setIsManualMode,
    setSendMemo,
    setRecipientError,
    setAmountError,
    toggleAmountCurrency,
    setSendAssetContractId,
    handleResolveRecipient,
    handleSendPayment,
    resetSendPayment,
    cacheRecipientResolution,
    goBackToRecipient,
  }
}
