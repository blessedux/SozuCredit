/**
 * Custom hook for wallet data management
 * Handles wallet address, balances, transaction history, and related state
 */

import { useState, useEffect, useCallback, useRef } from "react"
import { getUserId } from "@/lib/wallet-utils"
import { parseApyFromApiResponse } from "@/lib/defindex/parse-apy-response"
import { deferNonCritical } from "@/lib/defer-non-critical"

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
  walletBalance: number
  strategyBalance: number
  totalBalance: number
  strategyShares: number
  apy: number
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
    return sessionStorage.getItem("stellar_public_key") || ""
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
  const hasAttemptedWalletRegisterRef = useRef(false)
  /** One-shot client bootstrap: avoids Strict Mode double-fetch and dependency churn loops. */
  const walletBootstrapDoneRef = useRef(false)

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

  // Fetch USDC balance from Stellar wallet
  const fetchWalletUSDCBalance = useCallback(async (publicKey: string) => {
    if (!publicKey) {
      console.warn("[Wallet] No public key provided for USDC balance fetch")
      return
    }
    
    try {
      console.log("[Wallet] 🔍 Fetching USDC balance directly from Stellar wallet:", publicKey.substring(0, 10) + "...")
      const { getUSDCBalanceClientSide } = await import("@/lib/stellar/client-wallet")
      const balance = await getUSDCBalanceClientSide(publicKey)
      console.log("[Wallet] ✅ USDC wallet balance fetched from Stellar:", balance)
      
      setDefindexBalance((prev) => {
        if (prev) {
          return {
            ...prev,
            walletBalance: balance,
            totalBalance: balance + (prev.strategyBalance || 0),
          }
        } else {
          return {
            walletBalance: balance,
            strategyBalance: 0,
            totalBalance: balance,
            strategyShares: 0,
            apy: 15.5,
          }
        }
      })
      setIsBalanceLoading(false)
    } catch (error) {
      console.error("[Wallet] ❌ Error fetching USDC wallet balance:", error)
    }
  }, [])

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
  const fetchDefindexBalance = useCallback(async (userId: string) => {
    try {
      console.log("[Wallet] Fetching DeFindex balance")
      const defindexResponse = await fetch("/api/wallet/defindex/balance", {
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
            const walletBalance = prev?.walletBalance !== undefined && prev.walletBalance > 0 
              ? prev.walletBalance
              : (defindexData.walletBalance || 0)
            
            const strategyBalance = defindexData.strategyBalance || 0
            const totalBalance = walletBalance + strategyBalance
            
            return {
              walletBalance,
              strategyBalance,
              totalBalance,
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
    (publicKey: string, userId: string) => {
      void fetchWalletUSDCBalance(publicKey)
      void fetchDefindexBalance(userId)
      deferNonCritical(() => {
        void fetchTransactionHistory(publicKey)
        void fetchXLMBalance(publicKey, userId)
        void fetchAutoDepositStatus(userId)
        void fetchAPY(userId)
      })
    },
    [
      fetchWalletUSDCBalance,
      fetchDefindexBalance,
      fetchTransactionHistory,
      fetchXLMBalance,
      fetchAutoDepositStatus,
      fetchAPY,
    ],
  )

  // Fetch wallet address with retry logic
  const fetchWalletAddress = useCallback(async (userId: string, retryCount = 0): Promise<void> => {
    console.log(`[Wallet] Fetching wallet address for userId: ${userId} (attempt ${retryCount + 1})`)
    try {
      const walletAddressResponse = await fetch("/api/wallet/stellar/address", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
      })
      
      console.log(`[Wallet] Wallet address response status: ${walletAddressResponse.status}`)
      
      if (walletAddressResponse.ok) {
        const walletData = await walletAddressResponse.json()
        console.log("[Wallet] Wallet data received:", walletData)
        
        const derivedPublicKey = sessionStorage.getItem("stellar_public_key")
        let publicKeyToUse = walletData.publicKey
        
        if (derivedPublicKey) {
          console.log("[Wallet] Found derived public key in sessionStorage:", derivedPublicKey.substring(0, 10) + "...")
          if (derivedPublicKey !== walletData.publicKey) {
            console.log("[Wallet] ⚠️ Mismatch detected: Using derived keypair public key instead of database address")
            publicKeyToUse = derivedPublicKey
          } else {
            console.log("[Wallet] ✅ Public keys match")
          }
        }
        
        if (publicKeyToUse) {
          console.log("[Wallet] ✅ Stellar wallet address loaded:", publicKeyToUse)
          setWalletAddress(publicKeyToUse)
          if (walletData.network) {
            setWalletNetwork(walletData.network)
          }
          
          // Critical path: show balance fast
          bootstrapWalletFetches(publicKeyToUse, userId)

          return
        } else {
          console.warn("[Wallet] No public key in wallet response:", walletData)
          if (retryCount < 2 && !hasAttemptedWalletRegisterRef.current) {
            console.log("[Wallet] Attempting to register wallet with client-derived key (one-shot)...")
            hasAttemptedWalletRegisterRef.current = true
            try {
              const clientPublicKey = typeof window !== "undefined" ? sessionStorage.getItem("stellar_public_key") : null
              if (!clientPublicKey) {
                console.warn("[Wallet] No client-derived public key available; skipping server registration.")
                setWalletAddress("")
                setIsBalanceLoading(false)
                void fetchDefindexBalance(userId)
                return
              }
              const createResponse = await fetch("/api/wallet/stellar/create", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-user-id": userId,
                },
                body: JSON.stringify({ publicKey: clientPublicKey }),
              })
              
              if (createResponse.ok) {
                const createData = await createResponse.json()
                if (createData.publicKey) {
                  console.log("[Wallet] ✅ Wallet created and address loaded:", createData.publicKey)
                  setWalletAddress(createData.publicKey)
                  if (createData.network) {
                    setWalletNetwork(createData.network)
                  }
                  if (createData.network === "testnet") {
                    sessionStorage.setItem("sozu_auto_activate", "1")
                  }
                  bootstrapWalletFetches(createData.publicKey, userId)
                  return
                }
              }
              if (createResponse.status === 400) {
                console.log("[Wallet] Wallet must be created client-side (sign in with passkey or use Create wallet)")
                setWalletAddress("")
                setIsBalanceLoading(false)
                void fetchDefindexBalance(userId)
                return
              }
            } catch (createError) {
              console.error("[Wallet] Error creating wallet:", createError)
            }
            
            setTimeout(() => fetchWalletAddress(userId, retryCount + 1), 1500)
          } else {
            // Avoid infinite loops: if we already tried registration, fall back to session key (if any) and stop retrying.
            const sessionPublicKey = typeof window !== "undefined" ? sessionStorage.getItem("stellar_public_key") : null
            if (sessionPublicKey) {
              console.log("[Wallet] Falling back to session public key (DB not yet synced).")
              setWalletAddress(sessionPublicKey)
              bootstrapWalletFetches(sessionPublicKey, userId)
              return
            }
            setWalletAddress("")
            setIsBalanceLoading(false)
            void fetchDefindexBalance(userId)
          }
        }
      } else if (walletAddressResponse.status === 404) {
        if (retryCount === 0 && !hasAttemptedWalletRegisterRef.current) {
          try {
            const clientPublicKey = typeof window !== "undefined" ? sessionStorage.getItem("stellar_public_key") : null
            hasAttemptedWalletRegisterRef.current = true
            if (!clientPublicKey) {
              setWalletAddress("")
              setIsBalanceLoading(false)
              void fetchDefindexBalance(userId)
              return
            }
            const createResponse = await fetch("/api/wallet/stellar/create", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-user-id": userId,
              },
              body: JSON.stringify({ publicKey: clientPublicKey }),
            })
            
            if (createResponse.ok) {
              const createData = await createResponse.json()
              if (createData.publicKey) {
                console.log("[Wallet] ✅ Wallet created/retrieved and address loaded:", createData.publicKey)
                setWalletAddress(createData.publicKey)
                if (createData.network) {
                  setWalletNetwork(createData.network)
                }
                if (createData.network === "testnet") {
                  sessionStorage.setItem("sozu_auto_activate", "1")
                }
                bootstrapWalletFetches(createData.publicKey, userId)
                return
              }
            }
            if (createResponse.status === 400) {
              setWalletAddress("")
              setIsBalanceLoading(false)
              void fetchDefindexBalance(userId)
              return
            }
          } catch (createError) {
            console.error("[Wallet] Error creating wallet:", createError)
          }
        }
        
        // Stop looping hard on 404: rely on session public key UX while server catches up.
        const sessionPublicKey = typeof window !== "undefined" ? sessionStorage.getItem("stellar_public_key") : null
        if (sessionPublicKey) {
          setWalletAddress(sessionPublicKey)
          void fetchWalletUSDCBalance(sessionPublicKey)
          void fetchDefindexBalance(userId)
          deferNonCritical(() => {
            void fetchTransactionHistory(sessionPublicKey)
          })
          return
        }
        setWalletAddress("")
        setIsBalanceLoading(false)
        fetchDefindexBalance(userId)
      } else if (walletAddressResponse.status === 500) {
        if (retryCount < 3) {
          console.log(`[Wallet] Retrying after error (attempt ${retryCount + 1}/3)...`)
          setTimeout(() => fetchWalletAddress(userId, retryCount + 1), 2000)
        } else {
          console.error("[Wallet] Failed to fetch wallet address after retries - stopping loading")
          setWalletAddress("")
          setIsBalanceLoading(false)
          fetchDefindexBalance(userId)
        }
      } else {
        if (retryCount < 5) {
          setTimeout(() => fetchWalletAddress(userId, retryCount + 1), 2000)
        } else {
          setWalletAddress("")
          setIsBalanceLoading(false)
          void fetchDefindexBalance(userId)
        }
      }
    } catch (walletError) {
      console.error("[Wallet] Exception fetching Stellar wallet address:", walletError)
      if (retryCount < 5) {
        setTimeout(() => fetchWalletAddress(userId, retryCount + 1), 2000)
      } else {
        setWalletAddress("")
        setIsBalanceLoading(false)
        void fetchDefindexBalance(userId)
      }
    }
  }, [bootstrapWalletFetches, fetchDefindexBalance])

  // Initialize wallet data (mount only: dev and prod both require a real /auth session)
  useEffect(() => {
    if (typeof window === "undefined") return
    if (walletBootstrapDoneRef.current) return
    walletBootstrapDoneRef.current = true

    // Prefer client-derived public key (passkey-derived) to avoid showing
    // wallet-creation CTAs while we sync with the server/DB.
    const sessionPublicKey = sessionStorage.getItem("stellar_public_key")
    if (sessionPublicKey && !walletAddress) {
      setWalletAddress(sessionPublicKey)
      void fetchWalletUSDCBalance(sessionPublicKey)
      deferNonCritical(() => {
        void fetchTransactionHistory(sessionPublicKey)
      })
    }

    const checkAuth = () => {
      const isAuthenticated = sessionStorage.getItem("dev_authenticated") === "true"
      const rawUserId = sessionStorage.getItem("dev_username")
      const hasStellar = !!sessionStorage.getItem("stellar_public_key")

      // Legacy dev shortcut created dev-user-* IDs with no passkey / no Stellar key — clear and send to auth.
      if (
        typeof rawUserId === "string" &&
        rawUserId.startsWith("dev-user-") &&
        !hasStellar
      ) {
        sessionStorage.removeItem("dev_username")
        sessionStorage.removeItem("dev_authenticated")
        window.location.replace("/auth")
        return
      }

      if (!isAuthenticated) {
        setTimeout(() => {
          const retryCheck = sessionStorage.getItem("dev_authenticated") === "true"
          if (!retryCheck) {
            window.location.replace("/auth")
          } else {
            fetchVaultData()
          }
        }, 1500)
      } else {
        fetchVaultData()
      }
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

        // Fetch wallet address
        fetchWalletAddress(userId)
      } catch (err) {
        console.error("[Wallet] Error fetching data:", err)
        setError(err instanceof Error ? err.message : "Failed to load data")
      } finally {
        setIsLoading(false)
      }
    }
    
    checkAuth()
    // Intentionally mount-only: including walletAddress / fetch* caused repeat vault+address loads (felt like an infinite loop).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap once; refresh flows use explicit handlers
  }, [])

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
    // Actions
    fetchWalletUSDCBalance,
    fetchXLMBalance,
    fetchTransactionHistory,
    fetchDefindexBalance,
    fetchAPY,
    fetchAutoDepositStatus,
    setWalletAddress,
    setWalletNetwork,
    setIsBalanceLoading,
  }
}
