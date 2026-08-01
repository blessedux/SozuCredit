/**
 * Custom hook for wallet data management
 * Handles wallet address, balances, transaction history, and related state
 */

import { useState, useEffect, useCallback, useRef } from "react"
import { getUserId } from "@/lib/wallet-utils"
import { parseApyFromApiResponse } from "@/lib/defindex/parse-apy-response"
import { deferNonCritical } from "@/lib/defer-non-critical"
import { isClientAuthed } from "@/lib/client-auth-gate"

export interface Vault {
  id: string
  balance: number
  yield_rate: number
  alias: string | null
}

export interface TrustPoints {
  balance: number
  last_daily_credit: string | null
}

export interface DefindexBalance {
  /** BlendUSDC on C — used for Soroban sends. */
  walletBalance: number
  /** Circle USDC SAC on C (testnet) — shown on Stellar Expert. */
  sorobanSacBalance: number
  /** Soroban spendable on C (unique contracts; send picks one per tx). */
  spendableOnC?: number
  strategyBalance: number
  /** @deprecated Use displayBalance — kept for audit panel total row migration. */
  totalBalance: number
  /** Primary balance card figure (wallet + strategy + classic on G signer when applicable). */
  displayBalance: number
  classicOnSigner: number
  /** USDC mistakenly on G — not in totals; migration hint only. */
  legacyUsdcOnSigner?: number
  strategyShares: number
  apy: number
  tokenBalances?: Array<{
    assetId: string
    contractId: string
    balance: number
    displayName?: string
  }>
  contractIds?: { blend?: string | null; circleSac?: string | null }
}

export interface AutoDepositStatus {
  wouldTrigger: boolean
  currentBalance: number
  previousBalance: number | null
}

export interface Transaction {
  id: string
  hash: string
  createdAt: string
  successful: boolean
  memo: string | null
  operations: Array<{
    type: string
    from: string
    to: string
    amount: number
    asset: string
    memo?: string | null
  }>
}

export function useWalletData() {
  const [vault, setVault] = useState<Vault | null>(null)
  const [trustPoints, setTrustPoints] = useState<TrustPoints | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isBalanceLoading, setIsBalanceLoading] = useState(true)
  const [xlmBalance, setXlmBalance] = useState<number | null>(null)
  const [walletAddress, setWalletAddress] = useState(() => {
    if (typeof window === "undefined") return ""
    if (!isClientAuthed()) return ""
    return (
      localStorage.getItem("stellar_public_key") ??
      sessionStorage.getItem("stellar_public_key") ??
      ""
    )
  })
  const [walletNetwork, setWalletNetwork] = useState<"testnet" | "mainnet">("testnet")
  const [username, setUsername] = useState("")
  const [xlmPriceUSD, setXlmPriceUSD] = useState<number | null>(null)
  const [defindexBalance, setDefindexBalance] = useState<DefindexBalance | null>(null)
  const [autoDepositStatus, setAutoDepositStatus] = useState<AutoDepositStatus | null>(null)
  const [apyValue, setApyValue] = useState<number | null>(null)
  const [apyLoading, setApyLoading] = useState(true)
  const [transactionHistory, setTransactionHistory] = useState<Transaction[]>([])
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false)
  const [addressToTagMap, setAddressToTagMap] = useState<Record<string, string>>({})
  /** One-shot client bootstrap: avoids Strict Mode double-fetch and dependency churn loops. */
  const walletBootstrapDoneRef = useRef(false)
  const [setupIncomplete, setSetupIncomplete] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(() => {
    if (typeof window === "undefined") return null
    return sessionStorage.getItem("wallet_setup_error")
  })
  const [isFinishingSetup, setIsFinishingSetup] = useState(false)

  // LRU cache for address-to-tag mapping (limit to 100 entries)
  const updateAddressToTagMap = useCallback((address: string, tag: string) => {
    setAddressToTagMap(prev => {
      const entries = Object.entries(prev)
      
      // If address already exists, update it and move to end
      if (prev[address]) {
        const { [address]: removed, ...rest } = prev
        return { ...rest, [address]: tag }
      }
      
      // If cache is full, remove oldest entry (first one)
      if (entries.length >= 100) {
        const [[oldestAddress]] = entries
        const { [oldestAddress]: removed, ...rest } = prev
        return { ...rest, [address]: tag }
      }
      
      // Add new entry
      return { ...prev, [address]: tag }
    })
  }, [])

  /** Single balance source: C-wallet spendable USDC + DeFindex strategy (no G+C double count). */
  const refreshUnifiedBalance = useCallback(async (userId: string, publicKey?: string) => {
    try {
      const { fetchUnifiedUsdcBalance } = await import("@/lib/wallet/unified-usdc-balance")
      const pk =
        publicKey?.trim().toUpperCase() ||
        (typeof window !== "undefined"
          ? localStorage.getItem("stellar_public_key") ??
            sessionStorage.getItem("stellar_public_key") ??
            ""
          : "")

      const requestedPk = publicKey?.trim().toUpperCase()
      const unified = await fetchUnifiedUsdcBalance(userId, pk || undefined)
      if (!unified) {
        console.warn("[Wallet] Unified balance fetch failed for", pk?.slice(0, 12) || userId)
        setIsBalanceLoading(false)
        return
      }
      console.log("[Wallet] ✅ Unified USDC balance:", unified)

      const sessionPk =
        typeof window !== "undefined"
          ? (
              localStorage.getItem("stellar_public_key") ??
              sessionStorage.getItem("stellar_public_key")
            )
              ?.trim()
              .toUpperCase()
          : null

      if (
        sessionPk?.startsWith("C") &&
        unified.walletAddress &&
        unified.walletAddress !== sessionPk &&
        unified.displayBalance === 0
      ) {
        console.warn(
          "[Wallet] DB address differs from session and balance is 0 — retrying with session C",
          { db: unified.walletAddress.slice(0, 12), session: sessionPk.slice(0, 12) },
        )
        const retry = await fetchUnifiedUsdcBalance(userId, sessionPk)
        if (retry && retry.displayBalance > 0) {
          setDefindexBalance((prev) => ({
            walletBalance: retry.walletBalance,
            sorobanSacBalance: retry.sorobanSacBalance,
            spendableOnC: retry.spendableOnC,
            strategyBalance: retry.strategyBalance,
            totalBalance: retry.displayBalance,
            displayBalance: retry.displayBalance,
            classicOnSigner: retry.classicOnSigner,
            legacyUsdcOnSigner: retry.legacyUsdcOnSigner,
            strategyShares: prev?.strategyShares ?? 0,
            apy: prev?.apy ?? 15.5,
            tokenBalances: retry.tokenBalances,
            contractIds: retry.contractIds,
          }))
          setWalletAddress(sessionPk)
          return
        }
      }

      setDefindexBalance((prev) => ({
        walletBalance: unified.walletBalance,
        sorobanSacBalance: unified.sorobanSacBalance,
        spendableOnC: unified.spendableOnC,
        strategyBalance: unified.strategyBalance,
        totalBalance: unified.displayBalance,
        displayBalance: unified.displayBalance,
        classicOnSigner: unified.classicOnSigner,
        legacyUsdcOnSigner: unified.legacyUsdcOnSigner,
        strategyShares: prev?.strategyShares ?? 0,
        apy: prev?.apy ?? 15.5,
        tokenBalances: unified.tokenBalances,
        contractIds: unified.contractIds,
      }))

      let addressToPersist = requestedPk || unified.walletAddress
      if (
        addressToPersist?.startsWith("G") &&
        sessionPk?.startsWith("C") &&
        sessionPk.length === 56
      ) {
        addressToPersist = sessionPk
      } else if (unified.walletAddress?.startsWith("C")) {
        addressToPersist = unified.walletAddress
      } else if (requestedPk?.startsWith("C")) {
        addressToPersist = requestedPk
      }

      if (addressToPersist && addressToPersist.length === 56) {
        setWalletAddress(addressToPersist)
        if (typeof window !== "undefined" && addressToPersist.startsWith("C")) {
          localStorage.setItem("stellar_public_key", addressToPersist)
          sessionStorage.setItem("stellar_public_key", addressToPersist)
        }
      }
    } catch (error) {
      console.error("[Wallet] ❌ Error fetching unified balance:", error)
    } finally {
      setIsBalanceLoading(false)
    }
  }, [])

  const refreshBalanceFromSession = useCallback(
    (userId: string) => {
      if (typeof window === "undefined") return
      const sessionPk =
        localStorage.getItem("stellar_public_key") ??
        sessionStorage.getItem("stellar_public_key")
      const pk = sessionPk?.trim().toUpperCase()
      if (pk?.startsWith("C") && pk.length === 56) {
        void refreshUnifiedBalance(userId, pk)
      } else {
        void refreshUnifiedBalance(userId)
      }
    },
    [refreshUnifiedBalance],
  )

  const fetchWalletUSDCBalance = useCallback(
    async (publicKey: string) => {
      const userId = getUserId()
      if (!userId) return
      await refreshUnifiedBalance(userId, publicKey)
    },
    [refreshUnifiedBalance],
  )

  // Resolve address to Sozu tag
  const resolveAddressToTag = useCallback(async (address: string): Promise<string | null> => {
    if (addressToTagMap[address]) {
      return addressToTagMap[address]
    }

    try {
      const response = await fetch("/api/wallet/resolve-address-to-tag", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ address }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.tag) {
          updateAddressToTagMap(address, data.tag)
          return data.tag
        }
      }
    } catch (error) {
      console.error("[Wallet] Error resolving address to tag:", error)
    }
    return null
  }, [addressToTagMap, updateAddressToTagMap])

  // Fetch transaction history
  const fetchTransactionHistory = useCallback(async (publicKey: string) => {
    if (!publicKey) {
      console.warn("[Wallet] No public key provided for transaction history fetch")
      return
    }
    
    setIsLoadingTransactions(true)
    try {
      const userId = getUserId()
      
      console.log("[Wallet] 🔍 Fetching transaction history for:", publicKey.substring(0, 10) + "...")
      const response = await fetch(`/api/wallet/stellar/transactions?publicKey=${publicKey}&limit=100`, {
        headers: {
          "x-user-id": userId || "",
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.transactions) {
          console.log("[Wallet] ✅ Transaction history fetched:", data.transactions.length, "transactions")
          
          // Resolve addresses to tags for all transactions
          const addressesToResolve = new Set<string>()
          data.transactions.forEach((tx: any) => {
            const paymentOp = tx.operations.find((op: any) => op.type === "payment")
            if (paymentOp) {
              if (paymentOp.from && paymentOp.from !== publicKey) addressesToResolve.add(paymentOp.from)
              if (paymentOp.to && paymentOp.to !== publicKey) addressesToResolve.add(paymentOp.to)
            }
          })
          
          // Resolve all addresses in parallel
          const resolvePromises = Array.from(addressesToResolve).map(addr => resolveAddressToTag(addr))
          await Promise.all(resolvePromises)
          
          setTransactionHistory(data.transactions)
        }
      } else {
        console.warn("[Wallet] Could not fetch transaction history:", response.status)
      }
    } catch (error) {
      console.error("[Wallet] ❌ Error fetching transaction history:", error)
    } finally {
      setIsLoadingTransactions(false)
    }
  }, [resolveAddressToTag])

  // Fetch DeFindex balance
  const fetchDefindexBalance = useCallback(async (userId: string, publicKey?: string) => {
    try {
      console.log("[Wallet] Fetching DeFindex balance")
      const qs =
        publicKey && /^(C|G)[A-Z0-9]{55}$/.test(publicKey)
          ? `?publicKey=${encodeURIComponent(publicKey)}`
          : ""
      const defindexResponse = await fetch(`/api/wallet/defindex/balance${qs}`, {
        headers: {
          "x-user-id": userId,
        },
      })

      if (defindexResponse.ok) {
        const defindexData = await defindexResponse.json()
        console.log("[Wallet] DeFindex balance received:", defindexData)
        
        if (defindexData.success) {
          const apyNumber = typeof defindexData.apy === 'number' 
            ? defindexData.apy 
            : Number(defindexData.apy) || 15.5
          
          setDefindexBalance((prev) => {
            if (!prev) {
              // Wait for refreshUnifiedBalance — do not seed displayBalance: 0
              return prev
            }
            const strategyBalance = defindexData.strategyBalance || 0
            return {
              ...prev,
              strategyBalance,
              totalBalance: prev.displayBalance,
              strategyShares: defindexData.strategyShares || 0,
              apy: apyNumber,
            }
          })
          
          if (apyNumber) {
            setApyValue(apyNumber)
            setApyLoading(false)
          }
        }
        setIsBalanceLoading(false)
      } else {
        console.warn("[Wallet] Failed to fetch DeFindex balance:", defindexResponse.status)
        setIsBalanceLoading(false)
      }
    } catch (error) {
      console.error("[Wallet] Error fetching DeFindex balance:", error)
      setIsBalanceLoading(false)
    }
  }, [])

  // Fetch APY
  const fetchAPY = useCallback(async (userId: string) => {
    try {
      setApyLoading(true)
      const apyResponse = await fetch("/api/wallet/defindex/apy", {
        headers: {
          "x-user-id": userId,
        },
      })

      if (apyResponse.ok) {
        const apyData = await apyResponse.json()
        const apyNumber = parseApyFromApiResponse(apyData)
        if (apyNumber !== null) {
          setApyValue(apyNumber)
        }
      }
    } catch (error) {
      console.error("[Wallet] Error fetching APY:", error)
    } finally {
      setApyLoading(false)
    }
  }, [])

  // Fetch auto-deposit status
  const fetchAutoDepositStatus = useCallback(async (userId: string) => {
    try {
      console.log("[Wallet] Fetching auto-deposit status")
      const autoDepositResponse = await fetch("/api/wallet/defindex/auto-deposit", {
        headers: {
          "x-user-id": userId,
        },
      })

      if (autoDepositResponse.ok) {
        const autoDepositData = await autoDepositResponse.json()
        console.log("[Wallet] Auto-deposit status received:", autoDepositData)
        if (autoDepositData.success) {
          setAutoDepositStatus({
            wouldTrigger: autoDepositData.wouldTriggerAutoDeposit,
            currentBalance: autoDepositData.currentBalance,
            previousBalance: autoDepositData.previousBalance,
          })
        }
      } else {
        console.warn("[Wallet] Failed to fetch auto-deposit status:", autoDepositResponse.status)
      }
    } catch (error) {
      console.error("[Wallet] Error fetching auto-deposit status:", error)
    }
  }, [])

  // Fetch XLM balance
  const fetchXLMBalance = useCallback(async (
    publicKey: string,
    userId: string,
    options?: { gateBalance?: boolean },
  ) => {
    try {
      if (options?.gateBalance) setIsBalanceLoading(true)
      console.log("[Wallet] Fetching XLM balance for wallet:", publicKey)
      const balanceResponse = await fetch("/api/wallet/stellar/balance", {
        headers: {
          "x-user-id": userId,
        },
      })

      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json()
        console.log("[Wallet] XLM balance received:", balanceData)
        if (balanceData.balance !== undefined) {
          setXlmBalance(balanceData.balance)
        }
      } else {
        console.warn("[Wallet] Failed to fetch XLM balance:", balanceResponse.status)
      }
    } catch (error) {
      console.error("[Wallet] Error fetching XLM balance:", error)
    } finally {
      if (options?.gateBalance) setIsBalanceLoading(false)
    }
  }, [])

  const bootstrapWalletFetches = useCallback(
    async (publicKey: string, userId: string) => {
      const pk = publicKey.trim().toUpperCase()
      if (!pk.startsWith("C") && !pk.startsWith("G")) return

      setIsBalanceLoading(true)
      // Unified USDC must finish before DeFindex — otherwise defindex sets displayBalance: 0 and the card sticks at $0.
      await refreshUnifiedBalance(userId, pk)
      deferNonCritical(() => {
        void fetchDefindexBalance(userId, pk)
        void fetchTransactionHistory(pk)
        void fetchXLMBalance(pk, userId)
        void fetchAutoDepositStatus(userId)
        void fetchAPY(userId)
      })
    },
    [
      refreshUnifiedBalance,
      fetchDefindexBalance,
      fetchTransactionHistory,
      fetchXLMBalance,
      fetchAutoDepositStatus,
      fetchAPY,
    ],
  )

  /**
   * Read-only address load (ADR 0001). Never deploys a Smart Account.
   * Missing C → Setup Incomplete for an explicit Finish setup CTA.
   */
  const fetchWalletAddress = useCallback(async (userId: string): Promise<void> => {
    console.log(`[Wallet] Loading canonical wallet for userId: ${userId}`)
    try {
      const credId =
        sessionStorage.getItem("credential_id") ?? localStorage.getItem("credential_id") ?? undefined

      const { loadCanonicalWallet } = await import("@/lib/wallet/sync-canonical-wallet")
      const loaded = await loadCanonicalWallet(userId, credId ?? undefined)

      if (loaded?.publicKey.startsWith("C") && loaded.publicKey.length === 56) {
        console.log("[Wallet] ✅ Canonical wallet:", loaded.publicKey.substring(0, 10) + "…", loaded.walletType)
        setWalletAddress(loaded.publicKey)
        setSetupIncomplete(false)
        setSetupError(null)
        void bootstrapWalletFetches(loaded.publicKey, userId)
        return
      }

      console.info("[Wallet] No Smart Account on file — Setup Incomplete")
      setWalletAddress("")
      setSetupIncomplete(true)
      setSetupError(
        typeof window !== "undefined" ? sessionStorage.getItem("wallet_setup_error") : null,
      )
      setIsBalanceLoading(false)
    } catch (walletError) {
      console.error("[Wallet] Exception loading wallet address:", walletError)
      setWalletAddress("")
      setSetupIncomplete(true)
      setSetupError(walletError instanceof Error ? walletError.message : "Could not load wallet")
      setIsBalanceLoading(false)
    }
  }, [bootstrapWalletFetches])

  /** Explicit user-initiated Wallet Provisioning (Finish setup). */
  const finishWalletSetup = useCallback(async (): Promise<boolean> => {
    const userId = getUserId()
    if (!userId || isFinishingSetup) return false

    setIsFinishingSetup(true)
    setSetupError(null)
    try {
      const credId =
        sessionStorage.getItem("credential_id") ?? localStorage.getItem("credential_id") ?? ""
      if (!credId) {
        setSetupError("No passkey on this device. Sign in again.")
        return false
      }

      const { alignWalletMaterialAfterLogin } = await import("@/lib/storage/post-login-wallet")
      const result = await alignWalletMaterialAfterLogin(userId, credId)

      if (result.needsWalletSync || !result.publicKey.startsWith("C")) {
        setSetupIncomplete(true)
        setSetupError(result.setupError ?? "Could not finish wallet setup.")
        return false
      }

      setWalletAddress(result.publicKey)
      setSetupIncomplete(false)
      setSetupError(null)
      void bootstrapWalletFetches(result.publicKey, userId)
      return true
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setSetupIncomplete(true)
      setSetupError(msg)
      return false
    } finally {
      setIsFinishingSetup(false)
    }
  }, [bootstrapWalletFetches, isFinishingSetup])

  // Initialize wallet data (mount only: dev and prod both require a real /auth session)
  useEffect(() => {
    if (typeof window === "undefined") return
    if (walletBootstrapDoneRef.current) return
    walletBootstrapDoneRef.current = true

    // Prefer client-derived public key (passkey-derived) to avoid showing
    // wallet-creation CTAs while we sync with the server/DB.
    // Read from localStorage (persistent) falling back to sessionStorage (legacy).
    if (!isClientAuthed()) {
      window.location.replace(`/auth${window.location.search}${window.location.hash}`)
      return
    }

    const sessionPublicKey =
      localStorage.getItem("stellar_public_key") ?? sessionStorage.getItem("stellar_public_key")
    if (sessionPublicKey?.startsWith("C") && !walletAddress) {
      setWalletAddress(sessionPublicKey)
    }

    const checkAuth = () => {
      if (!isClientAuthed()) {
        window.location.replace(`/auth${window.location.search}${window.location.hash}`)
        return
      }
      fetchVaultData()
    }

    const fetchVaultData = async () => {
      try {
        const userId = getUserId()

        if (!userId) {
          setError("User ID not found")
          setIsLoading(false)
          return
        }
        
        const [vaultResponse, trustResponse] = await Promise.all([
          fetch("/api/wallet/vault", { headers: { "x-user-id": userId } }),
          fetch("/api/wallet/trust-points", { headers: { "x-user-id": userId } }),
        ])

        if (!vaultResponse.ok) {
          throw new Error("Failed to fetch vault data")
        }

        const vaultData = await vaultResponse.json()
        setVault(vaultData.vault)

        if (trustResponse.ok) {
          const trustData = await trustResponse.json()
          setTrustPoints(trustData.trustPoints)
        } else {
          setTrustPoints({ balance: 0, last_daily_credit: null })
        }
        
        // Get username
        const storedUsername = localStorage.getItem("sozu_username")
        if (storedUsername) {
          setUsername(storedUsername)
        } else {
          setUsername(userId.substring(0, 8))
        }

        const sessionPk =
          localStorage.getItem("stellar_public_key") ?? sessionStorage.getItem("stellar_public_key")
        if (sessionPk?.startsWith("C") && sessionPk.length === 56) {
          void bootstrapWalletFetches(sessionPk, userId)
        }

        fetchWalletAddress(userId)
      } catch (err) {
        console.error("[Wallet] Error fetching data:", err)
        setError(err instanceof Error ? err.message : "Failed to load data")
      } finally {
        setIsLoading(false)
      }
    }
    
    checkAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap once; refresh flows use explicit handlers
  }, [])

  /** Re-fetch USDC when canonical C address changes (e.g. after sync from DB). */
  useEffect(() => {
    if (typeof window === "undefined") return
    const pk = walletAddress.trim().toUpperCase()
    if (!pk.startsWith("C") || pk.length !== 56) return
    const userId = getUserId()
    if (!userId) return
    void refreshUnifiedBalance(userId, pk)
  }, [walletAddress, refreshUnifiedBalance])

  // Fetch XLM price — deferred; not needed for landing balance card
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const xlmResponse = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd")
        if (xlmResponse.ok) {
          const xlmData = await xlmResponse.json()
          setXlmPriceUSD(xlmData.stellar?.usd || null)
        }
      } catch (error) {
        console.error("[Wallet] Error fetching prices:", error)
        setXlmPriceUSD(0.11)
      }
    }

    deferNonCritical(() => {
      void fetchPrices()
    })
    const priceInterval = window.setInterval(fetchPrices, 5 * 60 * 1000)
    return () => window.clearInterval(priceInterval)
  }, [])

  return {
    // State
    vault,
    trustPoints,
    isLoading,
    error,
    isBalanceLoading,
    xlmBalance,
    walletAddress,
    walletNetwork,
    username,
    xlmPriceUSD,
    defindexBalance,
    autoDepositStatus,
    apyValue,
    apyLoading,
    transactionHistory,
    isLoadingTransactions,
    addressToTagMap,
    setupIncomplete,
    setupError,
    isFinishingSetup,
    // Actions
    fetchWalletUSDCBalance,
    fetchXLMBalance,
    fetchTransactionHistory,
    fetchDefindexBalance,
    fetchAPY,
    fetchAutoDepositStatus,
    fetchWalletAddress,
    finishWalletSetup,
    setWalletAddress,
    setWalletNetwork,
    setIsBalanceLoading,
  }
}
