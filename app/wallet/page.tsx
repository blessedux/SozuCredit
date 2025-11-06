"use client"

import { useEffect, useState, useRef } from "react"
import { Wallet, Award, ArrowLeft, Globe, LogOut } from "lucide-react"
import { FallingPattern } from "@/components/ui/falling-pattern"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { SlidingNumber } from "@/components/ui/sliding-number"
import { APYDisplay, APYBadge } from "@/components/defindex/apy-display"

interface Vault {
  id: string
  balance: number
  yield_rate: number
  alias: string | null
}

interface TrustPoints {
  balance: number
  last_daily_credit: string | null
}

export default function WalletPage() {
  const [vault, setVault] = useState<Vault | null>(null)
  const [trustPoints, setTrustPoints] = useState<TrustPoints | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isBalanceVisible, setIsBalanceVisible] = useState(true)
  const [xlmBalance, setXlmBalance] = useState<number | null>(null)
  const [isBalanceLoading, setIsBalanceLoading] = useState(true)
  const [isTrustModalOpen, setIsTrustModalOpen] = useState(false)
  const [isProfileSheetOpen, setIsProfileSheetOpen] = useState(false)
  const [modalView, setModalView] = useState<"main" | "invite" | "vouch">("main")
  const [vouchUsername, setVouchUsername] = useState("")
  const [vouchPoints, setVouchPoints] = useState("1")
  const [vouchLoading, setVouchLoading] = useState(false)
  const [inviteCode, setInviteCode] = useState("")
  
  // Profile state
  const [username, setUsername] = useState("")
  const [walletAddress, setWalletAddress] = useState("")
  const [walletNetwork, setWalletNetwork] = useState<"testnet" | "mainnet">("testnet")
  const [language, setLanguage] = useState<"es" | "en">("es")
  const [profilePic, setProfilePic] = useState<string | null>("/default_pfp.png")
  const [walletCopied, setWalletCopied] = useState(false)
  
  // Currency state
  const [currency, setCurrency] = useState<"XLM" | "USD" | "ARS">("ARS")
  const [xlmPriceUSD, setXlmPriceUSD] = useState<number | null>(null)
  const [usdToArsRate, setUsdToArsRate] = useState<number | null>(null)
  const [animatedBalance, setAnimatedBalance] = useState<number>(0)
  const [defindexBalance, setDefindexBalance] = useState<{
    walletBalance: number
    strategyBalance: number
    totalBalance: number
    strategyShares: number
    apy: number
  } | null>(null)
  const [autoDepositStatus, setAutoDepositStatus] = useState<{
    wouldTrigger: boolean
    currentBalance: number
    previousBalance: number | null
  } | null>(null)
  const [isAutoDepositing, setIsAutoDepositing] = useState(false)

  // Swipe gesture state

  // Function to fetch DeFindex balance
  const fetchDefindexBalance = async (userId: string) => {
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
          setDefindexBalance({
            walletBalance: defindexData.walletBalance,
            strategyBalance: defindexData.strategyBalance,
            totalBalance: defindexData.balance,
            strategyShares: defindexData.strategyShares,
            apy: defindexData.apy,
          })
        }
      } else {
        console.warn("[Wallet] Failed to fetch DeFindex balance:", defindexResponse.status)
      }
    } catch (error) {
      console.error("[Wallet] Error fetching DeFindex balance:", error)
    }
  }

  // Function to fetch auto-deposit status
  const fetchAutoDepositStatus = async (userId: string) => {
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
  }
  const touchStartX = useRef<number | null>(null)
  const touchEndX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const touchEndY = useRef<number | null>(null)
  const minSwipeDistance = 30 // Minimum distance for a swipe (reduced for better sensitivity)
  
  const texts = {
    es: {
      // Profile
      title: "Mi Perfil",
      editProfile: "Editar Perfil",
      username: "Nombre de Usuario",
      profilePicture: "Foto de Perfil",
      walletAddress: "Dirección de Billetera",
      walletAddressDesc: "Tu dirección privada de billetera",
      walletCopied: "Dirección copiada al portapapeles",
      clickToCopy: "Toca para copiar",
      addy: "Addy",
      fundYourAddress: "Fondea tu dirección para activar tu cuenta.",
      language: "Idioma",
      currency: "Moneda",
      currencyDesc: "Selecciona cómo quieres ver tu balance",
      save: "Guardar",
      cancel: "Cancelar",
      english: "Inglés",
      spanish: "Español",
      changePicture: "Cambiar Foto",
      xlm: "XLM",
      usd: "USD",
      ars: "ARS (Pesos Argentinos)",
      // Balance
      totalBalance: "Saldo Total",
      todayAPY: "APY de Hoy",
      // Trust Points
      trustPoints: "Puntos de Confianza",
      trustPointsTitle: "Puntos de Confianza",
      currentBalance: "Tu saldo actual:",
      whatAreTrustPoints: "¿Qué son los Puntos de Confianza?",
      trustPointsDesc: "Los puntos de confianza son una medida de tu reputación en la plataforma. Puedes usarlos para apoyar a otros usuarios o aumentar tu elegibilidad para créditos.",
      howToGetMore: "¿Cómo obtener más puntos?",
      waitForDaily: "Espera para reclamar tu bono diario",
      inviteUsers: "Invita nuevos usuarios con tu código de invitación",
      receivePoints: "Recibe puntos de otros usuarios que te apoyen",
      viewInviteCode: "Ver Código de Invitación",
      vouchForUser: "Apoyar un Proyecto",
      // Invite Code
      yourInviteCode: "Tu Código de Invitación",
      inviteCodeDesc: "Comparte este código con nuevos usuarios. Cuando se registren, ambos recibirán puntos adicionales.",
      copyCode: "Copiar Código",
      codeCopied: "Código copiado al portapapeles",
      back: "Volver",
      // Vouch
      vouchTitle: "Apoyar un Proyecto",
      vouchDesc: "Ingresa el nombre de usuario y envía puntos de confianza para apoyarlos.",
      usernameLabel: "Nombre de Usuario",
      usernamePlaceholder: "Nombre de usuario",
      pointsToSend: "Puntos a Enviar",
      available: "Disponible:",
      sending: "Enviando...",
      sendPoints: "Enviar Puntos",
      pointsSentSuccess: "Puntos de confianza enviados exitosamente",
      pointsSentError: "Error al enviar puntos",
      notAuthenticated: "Usuario no autenticado",
      // Profile button
      openProfile: "Abrir perfil",
      closeProfile: "Cerrar perfil",
      logout: "Cerrar Sesión",
      logoutConfirm: "¿Estás seguro de que quieres cerrar sesión?",
      // Social share
      inviteMessage: "¡Únete a Sozu Credit! Usa mi código de invitación: {code} y recibamos ambos puntos de confianza extra. 🚀",
      codeCopiedShare: "Código copiado al portapapeles. ¡Listo para compartir!",
    },
    en: {
      // Profile
      title: "My Profile",
      editProfile: "Edit Profile",
      username: "Username",
      profilePicture: "Profile Picture",
      walletAddress: "Wallet Address",
      walletAddressDesc: "Your private wallet address",
      walletCopied: "Address copied to clipboard",
      clickToCopy: "Tap to copy",
      addy: "Addy",
      fundYourAddress: "Fund your address to activate your account.",
      language: "Language",
      currency: "Currency",
      currencyDesc: "Select how you want to view your balance",
      save: "Save",
      cancel: "Cancel",
      english: "English",
      spanish: "Spanish",
      changePicture: "Change Picture",
      xlm: "XLM",
      usd: "USD",
      ars: "ARS (Argentine Pesos)",
      // Balance
      totalBalance: "Total Balance",
      todayAPY: "Today's APY",
      // Trust Points
      trustPoints: "Trust Points",
      trustPointsTitle: "Trust Points",
      currentBalance: "Your current balance:",
      whatAreTrustPoints: "What are Trust Points?",
      trustPointsDesc: "Trust points are a measure of your reputation on the platform. You can use them to support other users or increase your eligibility for credits.",
      howToGetMore: "How to get more points?",
      waitForDaily: "Wait to claim your daily bonus",
      inviteUsers: "Invite new users with your invite code",
      receivePoints: "Receive points from other users who support you",
      viewInviteCode: "View Invite Code",
      vouchForUser: "Vouch for Project",
      // Invite Code
      yourInviteCode: "Your Invite Code",
      inviteCodeDesc: "Share this code with new users. When they register, both of you will receive additional points.",
      copyCode: "Copy Code",
      codeCopied: "Code copied to clipboard",
      back: "Back",
      // Vouch
      vouchTitle: "Vouch for Project",
      vouchDesc: "Enter the username and send trust points to support them.",
      usernameLabel: "Username",
      usernamePlaceholder: "Username",
      pointsToSend: "Points to Send",
      available: "Available:",
      sending: "Sending...",
      sendPoints: "Send Points",
      pointsSentSuccess: "Trust points sent successfully",
      pointsSentError: "Error sending points",
      notAuthenticated: "User not authenticated",
      // Profile button
      openProfile: "Open profile",
      closeProfile: "Close profile",
      logout: "Log Out",
      logoutConfirm: "Are you sure you want to log out?",
      // Social share
      inviteMessage: "Join Sozu Credit! Use my invite code: {code} and let's both get extra trust points. 🚀",
      codeCopiedShare: "Code copied to clipboard. Ready to share!",
    },
  }
  
  const t = texts[language]

  // Load currency preference from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedCurrency = localStorage.getItem("sozu_currency") as "XLM" | "USD" | "ARS" | null
      if (savedCurrency && ["XLM", "USD", "ARS"].includes(savedCurrency)) {
        setCurrency(savedCurrency)
      }
    }
  }, [])

  // Fetch XLM price in USD and USD to ARS exchange rate
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        // Fetch XLM price in USD (using CoinGecko API)
        const xlmResponse = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd")
        if (xlmResponse.ok) {
          const xlmData = await xlmResponse.json()
          setXlmPriceUSD(xlmData.stellar?.usd || null)
        }

        // Fetch USD to ARS exchange rate (using exchangerate-api)
        const arsResponse = await fetch("https://api.exchangerate-api.com/v4/latest/USD")
        if (arsResponse.ok) {
          const arsData = await arsResponse.json()
          setUsdToArsRate(arsData.rates?.ARS || null)
        }
      } catch (error) {
        console.error("[Wallet] Error fetching prices:", error)
        // Set fallback rates if API fails
        setXlmPriceUSD(0.11) // Approximate XLM price in USD
        setUsdToArsRate(900.0) // Approximate USD to ARS rate
      }
    }

    fetchPrices()
    
    // Refresh prices every 5 minutes
    const priceInterval = setInterval(fetchPrices, 5 * 60 * 1000)
    
    return () => clearInterval(priceInterval)
  }, [])

  useEffect(() => {
    // Client-side auth check and data fetch
    if (typeof window !== "undefined") {
      // Check if we were redirected here
      const wasRedirected = sessionStorage.getItem("redirect_to_wallet") === "true"
      if (wasRedirected) {
        sessionStorage.removeItem("redirect_to_wallet")
      }
      
      const checkAuth = () => {
        const isAuthenticated = sessionStorage.getItem("dev_authenticated") === "true"
        
        if (!isAuthenticated) {
          // Wait to ensure we're not in the middle of setting sessionStorage
          setTimeout(() => {
            const retryCheck = sessionStorage.getItem("dev_authenticated") === "true"
            if (!retryCheck) {
              window.location.replace("/auth")
            } else {
              // If authenticated after retry, fetch vault data
              fetchVaultData()
            }
          }, 1500)
        } else {
          // Fetch vault data immediately if authenticated
          fetchVaultData()
        }
      }
      
      const fetchVaultData = async () => {
        try {
          const userId = sessionStorage.getItem("dev_username")
          
          if (!userId) {
            setError("User ID not found")
            setIsLoading(false)
            return
          }
          
          // Fetch vault data from API
          const vaultResponse = await fetch("/api/wallet/vault", {
            headers: {
              "x-user-id": userId,
            },
          })
          
          if (!vaultResponse.ok) {
            throw new Error("Failed to fetch vault data")
          }
          
          const vaultData = await vaultResponse.json()
          setVault(vaultData.vault)
          
          // Fetch trust points from API
          const trustResponse = await fetch("/api/wallet/trust-points", {
            headers: {
              "x-user-id": userId,
            },
          })
          
          if (trustResponse.ok) {
            const trustData = await trustResponse.json()
            setTrustPoints(trustData.trustPoints)
          } else {
            // Default to 5 trust points if fetch fails
            setTrustPoints({ balance: 5, last_daily_credit: null })
          }
          
          // Generate invite code from user ID
          const code = userId.substring(0, 8).toUpperCase()
          setInviteCode(code)
          
          // Fetch profile data from API
          const profileResponse = await fetch("/api/wallet/profile", {
            headers: {
              "x-user-id": userId,
            },
          })
          
          if (profileResponse.ok) {
            const profileData = await profileResponse.json()
            if (profileData.profile && profileData.profile.username) {
              setUsername(profileData.profile.username)
            } else {
              // Fallback to user ID substring if no username found
              setUsername(userId.substring(0, 8))
            }
          } else {
            // Fallback to user ID substring if profile fetch fails
            setUsername(userId.substring(0, 8))
          }
          
          // Function to fetch XLM balance from Stellar wallet
          const fetchXLMBalance = async (publicKey: string) => {
            try {
              setIsBalanceLoading(true)
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
                  setIsBalanceLoading(false)
                }
              } else {
                console.warn("[Wallet] Failed to fetch XLM balance:", balanceResponse.status)
                setIsBalanceLoading(false)
              }
            } catch (error) {
              console.error("[Wallet] Error fetching XLM balance:", error)
              setIsBalanceLoading(false)
            }
          }

          
          // Fetch real Stellar wallet address from API
          // Retry up to 5 times with delay to account for wallet creation during login
          const fetchWalletAddress = async (retryCount = 0) => {
            console.log(`[Wallet] Fetching wallet address for userId: ${userId} (attempt ${retryCount + 1})`)
            try {
              const walletAddressResponse = await fetch("/api/wallet/stellar/address", {
                method: "GET",
                headers: {
                  "Content-Type": "application/json",
                  "x-user-id": userId, // Include userId for authentication in dev mode
                },
              })
              
              console.log(`[Wallet] Wallet address response status: ${walletAddressResponse.status}`)
              
              if (walletAddressResponse.ok) {
                const walletData = await walletAddressResponse.json()
                console.log("[Wallet] Wallet data received:", walletData)
                if (walletData.publicKey) {
                  console.log("[Wallet] ✅ Stellar wallet address loaded:", walletData.publicKey)
                  setWalletAddress(walletData.publicKey)
                  if (walletData.network) {
                    setWalletNetwork(walletData.network)
                  }
                  
                  // Fetch XLM balance for this wallet
                  fetchXLMBalance(walletData.publicKey)

                  // Fetch DeFindex balance and auto-deposit status
                  fetchDefindexBalance(userId)
                  fetchAutoDepositStatus(userId)
                  
                  return // Success, no need to retry
                } else {
                  console.warn("[Wallet] No public key in wallet response:", walletData)
                  // If no public key but response is OK, try creating wallet
                  if (retryCount < 5) {
                    console.log(`[Wallet] Attempting to create wallet (attempt ${retryCount + 1}/5)...`)
                    try {
                      // Try to create wallet via API
                      const createResponse = await fetch("/api/wallet/stellar/create", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          "x-user-id": userId,
                        },
                      })
                      
                      if (createResponse.ok) {
                        const createData = await createResponse.json()
                        if (createData.publicKey) {
                          console.log("[Wallet] ✅ Wallet created and address loaded:", createData.publicKey)
                          setWalletAddress(createData.publicKey)
                          if (createData.network) {
                            setWalletNetwork(createData.network)
                          }
                          // Fetch XLM balance for this wallet
                          fetchXLMBalance(createData.publicKey)

                          // Fetch DeFindex balance and auto-deposit status
                          fetchDefindexBalance(userId)
                          fetchAutoDepositStatus(userId)
                          return
                        }
                      }
                    } catch (createError) {
                      console.error("[Wallet] Error creating wallet:", createError)
                    }
                    
                    // Retry after delay
                    setTimeout(() => fetchWalletAddress(retryCount + 1), 2000)
                  } else {
                    setWalletAddress("") // Empty if wallet not created yet
                  }
                }
              } else if (walletAddressResponse.status === 404) {
                // Wallet not found - try creating it once
                console.log(`[Wallet] Wallet not found (404), attempting to create...`)
                
                if (retryCount === 0) {
                  // Only try to create wallet once on first attempt
                  try {
                    // Try to create wallet via API (which will check for existing wallet first)
                    const createResponse = await fetch("/api/wallet/stellar/create", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "x-user-id": userId,
                      },
                    })
                    
                    console.log(`[Wallet] Create wallet response status: ${createResponse.status}`)
                    
                    if (createResponse.ok) {
                      const createData = await createResponse.json()
                      console.log("[Wallet] Create wallet data:", createData)
                      if (createData.publicKey) {
                        console.log("[Wallet] ✅ Wallet created/retrieved and address loaded:", createData.publicKey)
                        setWalletAddress(createData.publicKey)
                        if (createData.network) {
                          setWalletNetwork(createData.network)
                        }
                        // Fetch XLM balance for this wallet
                        fetchXLMBalance(createData.publicKey)
                        return
                      }
                    } else {
                      const errorData = await createResponse.json().catch(() => ({}))
                      console.error("[Wallet] Failed to create wallet:", errorData)
                      // If creation fails, retry fetching address in case it was created by another process
                      if (retryCount < 3) {
                        setTimeout(() => fetchWalletAddress(retryCount + 1), 2000)
                        return
                      }
                    }
                  } catch (createError) {
                    console.error("[Wallet] Error creating wallet:", createError)
                    // Retry fetching address
                    if (retryCount < 3) {
                      setTimeout(() => fetchWalletAddress(retryCount + 1), 2000)
                      return
                    }
                  }
                } else {
                  // On retries, just try fetching the address again (might have been created)
                  if (retryCount < 3) {
                    console.log(`[Wallet] Retrying address fetch (attempt ${retryCount + 1}/3)...`)
                    setTimeout(() => fetchWalletAddress(retryCount + 1), 2000)
                    return
                  }
                }
                
                if (retryCount >= 3) {
                  console.log("[Wallet] Wallet not found after retries")
                  setWalletAddress("") // Empty if wallet not created yet
                }
              } else if (walletAddressResponse.status === 500) {
                // 500 error - log and retry a few times, but don't recreate wallet
                const errorData = await walletAddressResponse.json().catch(() => ({}))
                console.error("[Wallet] Error fetching wallet address:", walletAddressResponse.status, errorData)
                
                // Retry on error if we haven't exceeded limit (might be temporary server issue)
                if (retryCount < 3) {
                  console.log(`[Wallet] Retrying after error (attempt ${retryCount + 1}/3)...`)
                  setTimeout(() => fetchWalletAddress(retryCount + 1), 2000)
                } else {
                  console.error("[Wallet] Failed to fetch wallet address after retries")
                  setWalletAddress("") // Empty on error after retries
                }
              } else {
                const errorData = await walletAddressResponse.json().catch(() => ({}))
                console.error("[Wallet] Error fetching wallet address:", walletAddressResponse.status, errorData)
                // Retry on error if we haven't exceeded limit
                if (retryCount < 5) {
                  setTimeout(() => fetchWalletAddress(retryCount + 1), 2000)
                } else {
                  setWalletAddress("") // Empty on error after retries
                }
              }
            } catch (walletError) {
              console.error("[Wallet] Exception fetching Stellar wallet address:", walletError)
              // Retry on error if we haven't exceeded limit
              if (retryCount < 5) {
                setTimeout(() => fetchWalletAddress(retryCount + 1), 2000)
              } else {
                setWalletAddress("") // Empty on error after retries
              }
            }
          }
          
          // Start fetching wallet address
          fetchWalletAddress()
        } catch (err) {
          console.error("[Wallet] Error fetching data:", err)
          setError(err instanceof Error ? err.message : "Failed to load data")
        } finally {
          setIsLoading(false)
        }
      }
      
      // Check immediately
      checkAuth()
    }
  }, [])


  // Convert balance based on selected currency
  const getBaseBalance = () => {
    const xlmBalanceNum = xlmBalance !== null ? Number(xlmBalance) : Number(vault?.balance || 0)
    
    if (currency === "XLM") {
      return xlmBalanceNum
    } else if (currency === "USD") {
      // Convert XLM to USD
      if (xlmPriceUSD) {
        return xlmBalanceNum * xlmPriceUSD
      }
      return xlmBalanceNum * 0.11 // Fallback
    } else if (currency === "ARS") {
      // Convert XLM to ARS (via USD)
      if (xlmPriceUSD && usdToArsRate) {
        return xlmBalanceNum * xlmPriceUSD * usdToArsRate
      }
      return xlmBalanceNum * 0.11 * 900.0 // Fallback
    }
    return xlmBalanceNum
  }

  const baseBalance = getBaseBalance()

  // Use refs to track values for smooth animation
  const animatedBalanceRef = useRef(0)
  const baseBalanceRef = useRef(0)
  
  // Simple balance animation (no APY growth for now)
  useEffect(() => {
    // Check if base balance changed significantly (new funds received or currency changed)
    const baseChanged = Math.abs(baseBalance - baseBalanceRef.current) / (baseBalanceRef.current || 1) > 0.001

    // If we have a balance (even if it's 0) and we're still loading, mark as loaded
    if (xlmBalance !== null && isBalanceLoading) {
      setIsBalanceLoading(false)
    }

    if (baseChanged || animatedBalanceRef.current === 0) {
      // Reset to new base balance if it changed significantly or is initializing
      animatedBalanceRef.current = baseBalance
      baseBalanceRef.current = baseBalance
      setAnimatedBalance(baseBalance)
    }

    // Update balance every 100ms for smooth animation (without growth)
    const interval = setInterval(() => {
      // Check if base balance changed during interval
      if (Math.abs(baseBalance - baseBalanceRef.current) / (baseBalanceRef.current || 1) > 0.001) {
        // Base changed significantly, reset to it
        animatedBalanceRef.current = baseBalance
        baseBalanceRef.current = baseBalance
      }

      // For now, just keep the balance static (no growth animation)
      setAnimatedBalance(animatedBalanceRef.current)
    }, 100)

    return () => clearInterval(interval)
  }, [baseBalance])

  // Format balance to 4 decimals
  const balance = animatedBalance.toFixed(4)
  const maskedBalance = balance.replace(/\d/g, "*")
  
  // Get currency symbol for display
  const getCurrencySymbol = () => {
    if (currency === "XLM") return "XLM"
    if (currency === "USD") return "USD"
    if (currency === "ARS") return "ARS"
    return "ARS"
  }

  const toggleBalanceVisibility = () => {
    setIsBalanceVisible(!isBalanceVisible)
  }

  const handleVouch = async () => {
    if (!vouchUsername.trim() || !vouchPoints) {
      return
    }

    setVouchLoading(true)
    try {
      const userId = sessionStorage.getItem("dev_username")
      if (!userId) {
        throw new Error(t.notAuthenticated)
      }

      const response = await fetch("/api/wallet/vouch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({
          username: vouchUsername.trim(),
          points: parseInt(vouchPoints),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || t.pointsSentError)
      }

      // Refresh trust points after vouch
      const trustResponse = await fetch("/api/wallet/trust-points", {
        headers: {
          "x-user-id": userId,
        },
      })

      if (trustResponse.ok) {
        const trustData = await trustResponse.json()
        setTrustPoints(trustData.trustPoints)
      }

      // Reset form and go back to main view
      setVouchUsername("")
      setVouchPoints("1")
      setModalView("main")
      alert(t.pointsSentSuccess)
    } catch (err) {
      alert(err instanceof Error ? err.message : t.pointsSentError)
    } finally {
      setVouchLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    // TODO: Save profile changes to backend
    console.log("Saving profile:", { username, language, profilePic })
  }

  const handleAutoDeposit = async () => {
    if (!autoDepositStatus?.wouldTrigger) return

    setIsAutoDepositing(true)
    try {
      const response = await fetch("/api/wallet/defindex/auto-deposit", {
        method: "POST",
        headers: {
          "x-user-id": sessionStorage.getItem("dev_username") || "",
        },
      })

      const data = await response.json()

      if (data.success) {
        if (data.triggered) {
          alert(t.language === "es"
            ? `✅ Depósito automático exitoso: $${data.depositAmount} USDC depositados`
            : `✅ Auto-deposit successful: $${data.depositAmount} USDC deposited`
          )
          // Refresh balances
          const userId = sessionStorage.getItem("dev_username")
          if (userId) {
            fetchDefindexBalance(userId)
            fetchAutoDepositStatus(userId)
          }
        } else {
          alert(t.language === "es"
            ? "ℹ️ Depósito automático no activado"
            : "ℹ️ Auto-deposit not triggered"
          )
        }
      } else {
        alert(t.language === "es"
          ? `❌ Error en depósito automático: ${data.error}`
          : `❌ Auto-deposit error: ${data.error}`
        )
      }
    } catch (error) {
      console.error("[Wallet] Error triggering auto-deposit:", error)
      alert(t.language === "es"
        ? "❌ Error al procesar depósito automático"
        : "❌ Error processing auto-deposit"
      )
    } finally {
      setIsAutoDepositing(false)
    }
  }

  // Auto-save when profile sheet closes
  useEffect(() => {
    if (!isProfileSheetOpen && username.trim()) {
      // Sheet just closed, save username to backend
      const saveUsername = async () => {
        try {
          const userId = sessionStorage.getItem("dev_username")
          if (!userId) {
            console.warn("[Profile] Cannot save: user ID not found")
            return
          }

          const response = await fetch("/api/wallet/profile", {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "x-user-id": userId,
            },
            body: JSON.stringify({
              username: username.trim(),
              display_name: username.trim(),
            }),
          })

          if (!response.ok) {
            const error = await response.json()
            console.error("[Profile] Error saving username:", error)
            // Show error message to user
            if (error.error && error.error.includes("already taken")) {
              alert(t.language === "es" 
                ? "Este nombre de usuario ya está en uso" 
                : "This username is already taken")
              // Revert to previous username
              const profileResponse = await fetch("/api/wallet/profile", {
                headers: { "x-user-id": userId },
              })
              if (profileResponse.ok) {
                const profileData = await profileResponse.json()
                if (profileData.profile && profileData.profile.username) {
                  setUsername(profileData.profile.username)
                }
              }
            }
          } else {
            console.log("[Profile] Username saved successfully")
          }
        } catch (err) {
          console.error("[Profile] Error saving username:", err)
        }
      }

      saveUsername()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProfileSheetOpen])

  const handleLanguageChange = (lang: "es" | "en") => {
    setLanguage(lang)
    // TODO: Save language preference
  }

  const handleCurrencyChange = (curr: "XLM" | "USD" | "ARS") => {
    setCurrency(curr)
    // Save currency preference to localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("sozu_currency", curr)
    }
  }


  const handleProfilePictureChange = () => {
    // Create a file input element
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        // Create a preview URL for the selected image
        const reader = new FileReader()
        reader.onloadend = () => {
          setProfilePic(reader.result as string)
        }
        reader.readAsDataURL(file)
      }
    }
    input.click()
  }

  const handleLogout = () => {
    if (window.confirm(t.logoutConfirm)) {
      // Clear all session storage
      sessionStorage.clear()
      localStorage.removeItem("sozu_username")
      
      // Close profile sheet
      setIsProfileSheetOpen(false)
      
      // Redirect to auth page
      window.location.href = "/auth"
    }
  }

  const handleCopyWalletAddress = async () => {
    if (!walletAddress) {
      console.warn("Cannot copy: wallet address not available yet")
      return
    }
    try {
      await navigator.clipboard.writeText(walletAddress)
      setWalletCopied(true)
      setTimeout(() => setWalletCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy wallet address:", err)
    }
  }

  const handleOpenStellarExpert = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering copy when clicking icon
    if (!walletAddress) {
      console.warn("Cannot open Stellar Expert: wallet address not available yet")
      return
    }
    
    // Determine the Stellar Expert URL based on network
    const stellarExpertUrl = walletNetwork === "mainnet"
      ? `https://stellar.expert/explorer/mainnet/account/${walletAddress}`
      : `https://stellar.expert/explorer/testnet/account/${walletAddress}`
    
    // Open Stellar Expert in a new tab
    window.open(stellarExpertUrl, "_blank", "noopener,noreferrer")
  }

  // Swipe gesture handlers for opening menu (swipe right to left on main content)
  const onTouchStart = (e: React.TouchEvent) => {
    // Only track if menu is closed
    if (isProfileSheetOpen) return
    
    // Only track if it's a single touch (not multi-touch)
    if (e.targetTouches.length !== 1) return
    
    touchStartX.current = e.targetTouches[0].clientX
    touchStartY.current = e.targetTouches[0].clientY
    touchEndX.current = null
    touchEndY.current = null
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStartX.current || isProfileSheetOpen || e.targetTouches.length !== 1) return
    
    touchEndX.current = e.targetTouches[0].clientX
    touchEndY.current = e.targetTouches[0].clientY
    
    // Prevent default scrolling if horizontal swipe is detected
    if (touchStartX.current && touchEndX.current) {
      const distanceX = Math.abs(touchEndX.current - touchStartX.current)
      const distanceY = touchEndY.current && touchStartY.current 
        ? Math.abs(touchEndY.current - touchStartY.current) 
        : 0
      
      // If horizontal movement is greater than vertical, prevent vertical scroll
      if (distanceX > distanceY && distanceX > 10) {
        e.preventDefault()
      }
    }
  }

  const onTouchEnd = (e?: React.TouchEvent) => {
    if (!touchStartX.current || !touchEndX.current || !touchStartY.current || isProfileSheetOpen) {
      // Reset on any invalid state
      touchStartX.current = null
      touchEndX.current = null
      touchStartY.current = null
      touchEndY.current = null
      return
    }
    
    const distanceX = touchEndX.current - touchStartX.current
    const absDistanceX = Math.abs(distanceX)
    
    // Calculate Y distance if available, otherwise assume no significant vertical movement
    const absDistanceY = touchEndY.current && touchStartY.current 
      ? Math.abs(touchEndY.current - touchStartY.current) 
      : 0
    
    // Only trigger swipe if horizontal movement is significant and more than vertical
    // Use 1.2x ratio to be more lenient with diagonal swipes
    if (absDistanceX > minSwipeDistance && absDistanceX > absDistanceY * 1.2) {
      if (distanceX < 0) {
        // Swipe right to left - open menu
        console.log("[Swipe] Opening menu - swipe right to left detected", { distanceX, absDistanceX, absDistanceY })
        setIsProfileSheetOpen(true)
      }
    }
    
    // Reset touch positions
    touchStartX.current = null
    touchEndX.current = null
    touchStartY.current = null
    touchEndY.current = null
  }

  // Swipe gesture handlers for closing menu (swipe left to right on sheet content)
  const onSheetTouchStart = (e: React.TouchEvent) => {
    // Only track if menu is open
    if (!isProfileSheetOpen) return
    
    // Only track if it's a single touch (not multi-touch)
    if (e.targetTouches.length !== 1) return
    
    touchStartX.current = e.targetTouches[0].clientX
    touchStartY.current = e.targetTouches[0].clientY
    touchEndX.current = null
    touchEndY.current = null
  }

  const onSheetTouchMove = (e: React.TouchEvent) => {
    if (!touchStartX.current || !isProfileSheetOpen || e.targetTouches.length !== 1) return
    
    touchEndX.current = e.targetTouches[0].clientX
    touchEndY.current = e.targetTouches[0].clientY
    
    // Prevent default scrolling if horizontal swipe is detected
    if (touchStartX.current && touchEndX.current) {
      const distanceX = Math.abs(touchEndX.current - touchStartX.current)
      const distanceY = touchEndY.current && touchStartY.current 
        ? Math.abs(touchEndY.current - touchStartY.current) 
        : 0
      
      // If horizontal movement is greater than vertical, prevent vertical scroll
      if (distanceX > distanceY && distanceX > 10) {
        e.preventDefault()
      }
    }
  }

  const onSheetTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current || !touchStartY.current || !isProfileSheetOpen) {
      // Reset on any invalid state
      touchStartX.current = null
      touchEndX.current = null
      touchStartY.current = null
      touchEndY.current = null
      return
    }
    
    const distanceX = touchEndX.current - touchStartX.current
    const absDistanceX = Math.abs(distanceX)
    
    // Calculate Y distance if available
    const absDistanceY = touchEndY.current && touchStartY.current 
      ? Math.abs(touchEndY.current - touchStartY.current) 
      : 0
    
    // Swipe left to right to close - horizontal movement should be significant
    // Use 1.2x ratio to be more lenient with diagonal swipes
    if (absDistanceX > minSwipeDistance && absDistanceX > absDistanceY * 1.2 && distanceX > 0) {
      console.log("[Swipe] Closing menu - swipe left to right detected", { distanceX, absDistanceX, absDistanceY })
      setIsProfileSheetOpen(false)
    }
    
    // Reset touch positions
    touchStartX.current = null
    touchEndX.current = null
    touchStartY.current = null
    touchEndY.current = null
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black dark text-white">
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black dark text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400">Error: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black">
      {/* Falling Pattern Background */}
      <div className="absolute inset-0 z-0">
        <FallingPattern 
          className="h-full w-full" 
          backgroundColor="oklch(0 0 0)"
          color="oklch(1 0 0)"
        />
      </div>

      {/* Content */}
      <div 
        className="relative z-10 h-full overflow-y-auto touch-pan-y"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ touchAction: 'pan-y' }}
      >
        <div className="container mx-auto px-6 py-8 md:py-12">
          {/* Balance Display Box */}
          <div className="mb-8">
            <div className="border border-white/20 rounded-lg p-8 text-center">
              <div className="text-sm text-white/60 mb-4">{t.totalBalance} ({getCurrencySymbol()})</div>
              <div 
                className="text-6xl font-bold text-white cursor-pointer select-none flex items-center justify-center min-h-[4rem]"
                onClick={toggleBalanceVisibility}
              >
                {isBalanceLoading && xlmBalance === null ? (
                  <span className="tabular-nums">----</span>
                ) : isBalanceVisible ? (
                  <SlidingNumber value={animatedBalance} />
                ) : (
                  <span className="tabular-nums">{maskedBalance}</span>
                )}
              </div>
              {/* Real-time APY Display */}
              <div className="mt-2">
                <APYBadge strategyAddress="CBLXUUHUL7TA3LF3U5G6ZTU7EACBBOSJLR4AYOM5YJKJ4APZ7O547R5T" />
              </div>
            </div>

            {/* DeFindex Balance Breakdown */}
            {defindexBalance && (
              <div className="mt-4 space-y-2">
                <div className="text-sm text-white/60 text-center">
                  {t.language === "es" ? "Distribución de Balance" : "Balance Breakdown"}
                </div>

                {/* Wallet Balance */}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/80">
                    {t.language === "es" ? "Billetera" : "Wallet"}:
                  </span>
                  <span className="text-white font-medium">
                    ${defindexBalance.walletBalance.toFixed(2)} USDC
                  </span>
                </div>

                {/* Strategy Balance */}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/80">
                    {t.language === "es" ? "Estrategia DeFi" : "DeFi Strategy"}:
                  </span>
                  <span className="text-green-400 font-medium">
                    ${defindexBalance.strategyBalance.toFixed(2)} USDC
                  </span>
                </div>

                {/* Shares */}
                {defindexBalance.strategyShares > 0 && (
                  <div className="flex justify-between items-center text-xs text-white/60">
                    <span>{t.language === "es" ? "Acciones" : "Shares"}:</span>
                    <span>{defindexBalance.strategyShares.toFixed(4)}</span>
                  </div>
                )}

                {/* Auto-Deposit Button */}
                {autoDepositStatus && (
                  <div className="mt-3 pt-3 border-t border-white/20">
                    <button
                      onClick={handleAutoDeposit}
                      disabled={!autoDepositStatus.wouldTrigger || isAutoDepositing}
                      className={`w-full py-2 px-4 rounded text-sm font-medium transition-colors ${
                        autoDepositStatus.wouldTrigger && !isAutoDepositing
                          ? "bg-green-600 hover:bg-green-700 text-white"
                          : "bg-gray-600 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      {isAutoDepositing
                        ? (t.language === "es" ? "Depositando..." : "Depositing...")
                        : autoDepositStatus.wouldTrigger
                        ? (t.language === "es" ? "💰 Depositar Automáticamente" : "💰 Auto-Deposit")
                        : (t.language === "es" ? "Esperando fondos suficientes" : "Waiting for sufficient funds")
                      }
                    </button>

                    {autoDepositStatus.wouldTrigger && (
                      <div className="text-xs text-green-400 text-center mt-1">
                        {t.language === "es"
                          ? `$${Math.max(0, autoDepositStatus.currentBalance - 1).toFixed(2)} USDC disponible para depositar`
                          : `$${Math.max(0, autoDepositStatus.currentBalance - 1).toFixed(2)} USDC available to deposit`
                        }
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Trust Points - Bottom Left */}
        <button
          onClick={() => setIsTrustModalOpen(true)}
          className="fixed bottom-4 left-4 md:bottom-6 md:left-6 z-10"
        >
          <div className="px-5 py-3 md:px-4 md:py-2 flex items-center gap-2 md:gap-2 transition-colors cursor-pointer">
            <Award className="w-6 h-6 md:w-5 md:h-5 text-white" />
            <span className="text-white font-semibold text-base md:text-sm">
              {trustPoints?.balance || 5} TRUST
            </span>
          </div>
        </button>

        {/* Wallet Icon - Bottom Right */}
        <button
          onClick={() => setIsProfileSheetOpen(true)}
          className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-10"
          aria-label={t.openProfile}
        >
          <div className="w-16 h-16 md:w-14 md:h-14 flex items-center justify-center transition-colors cursor-pointer">
            <Wallet className="w-7 h-7 md:w-6 md:h-6 text-white" />
          </div>
        </button>
      </div>

      {/* Trust Points Modal */}
      <Dialog open={isTrustModalOpen} onOpenChange={setIsTrustModalOpen}>
        <DialogContent className="bg-black/80 backdrop-blur-md border-white/20 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white text-2xl">{t.trustPointsTitle}</DialogTitle>
            <DialogDescription className="text-white/60">
              {t.currentBalance} <span className="font-bold text-white">{trustPoints?.balance || 5} TRUST</span>
            </DialogDescription>
          </DialogHeader>

          {modalView === "main" && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-white">{t.whatAreTrustPoints}</h3>
                <p className="text-sm text-white/80">
                  {t.trustPointsDesc}
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-white">{t.howToGetMore}</h3>
                <ul className="text-sm text-white/80 space-y-1 list-disc list-inside">
                  <li>{t.waitForDaily}</li>
                  <li>{t.inviteUsers}</li>
                  <li>{t.receivePoints}</li>
                </ul>
              </div>

              <div className="flex flex-col gap-2 pt-4">
                <Button
                  onClick={() => setModalView("invite")}
                  variant="outline"
                  className="w-full border-2 border-white bg-transparent text-white hover:bg-white/10 font-semibold"
                >
                  {t.viewInviteCode}
                </Button>
                <Button
                  onClick={() => setModalView("vouch")}
                  variant="outline"
                  className="w-full border-2 border-white/30 bg-transparent text-white hover:bg-white/20 hover:border-white/50 font-semibold"
                >
                  {t.vouchForUser}
                </Button>
              </div>
            </div>
          )}

          {modalView === "invite" && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-white">{t.yourInviteCode}</h3>
                <p className="text-sm text-white/80">
                  {t.inviteCodeDesc}
                </p>
              </div>

              <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                <code className="text-xl font-bold text-white font-mono tracking-wider">
                  {inviteCode}
                </code>
              </div>

              <Button
                onClick={async () => {
                  try {
                    // Create social media ready message with invite code
                    const inviteMessage = t.inviteMessage.replace("{code}", inviteCode)
                    
                    // Copy to clipboard
                    await navigator.clipboard.writeText(inviteMessage)
                    
                    // Show success message
                    alert(t.codeCopiedShare)
                  } catch (err) {
                    // Fallback: just copy the code if share message fails
                    await navigator.clipboard.writeText(inviteCode)
                    alert(t.codeCopied)
                  }
                }}
                variant="outline"
                className="w-full border-2 border-white bg-transparent text-white hover:bg-white/10 font-semibold"
              >
                {t.copyCode}
              </Button>

              <Button
                onClick={() => setModalView("main")}
                variant="outline"
                className="w-full border-2 border-white/30 bg-transparent text-white hover:bg-white/20 hover:border-white/50"
              >
                {t.back}
              </Button>
            </div>
          )}

          {modalView === "vouch" && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-white">{t.vouchTitle}</h3>
                <p className="text-sm text-white/80">
                  {t.vouchDesc}
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-white">
                    {t.usernameLabel}
                  </Label>
                  <Input
                    id="username"
                    value={vouchUsername}
                    onChange={(e) => setVouchUsername(e.target.value)}
                    className="bg-black border-white/20 text-white"
                    placeholder={t.usernamePlaceholder}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="points" className="text-white">
                    {t.pointsToSend}
                  </Label>
                  <Input
                    id="points"
                    type="number"
                    min="1"
                    max={trustPoints?.balance || 5}
                    value={vouchPoints}
                    onChange={(e) => setVouchPoints(e.target.value)}
                    className="bg-black border-white/20 text-white"
                    placeholder="1"
                  />
                  <p className="text-xs text-white/60">
                    {t.available} {trustPoints?.balance || 5} TRUST
                  </p>
                </div>

                <Button
                  onClick={handleVouch}
                  disabled={vouchLoading || !vouchUsername.trim() || !vouchPoints}
                  variant="outline"
                  className="w-full border-2 border-white bg-transparent text-white hover:bg-white/10 font-semibold disabled:border-white/30 disabled:text-white/50 disabled:hover:bg-transparent"
                >
                  {vouchLoading ? t.sending : t.sendPoints}
                </Button>

                <Button
                  onClick={() => {
                    setModalView("main")
                    setVouchUsername("")
                    setVouchPoints("1")
                  }}
                  variant="outline"
                  className="w-full border-2 border-white/30 bg-transparent text-white hover:bg-white/20 hover:border-white/50"
                >
                  {t.cancel}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Profile Sheet - Slides in from right */}
      <Sheet open={isProfileSheetOpen} onOpenChange={setIsProfileSheetOpen}>
        <SheetContent 
          side="right" 
          className="bg-black border-white/20 text-white w-full sm:max-w-lg overflow-y-auto [&>button]:hidden touch-pan-y"
          onTouchStart={onSheetTouchStart}
          onTouchMove={onSheetTouchMove}
          onTouchEnd={onSheetTouchEnd}
          style={{ touchAction: 'pan-y' }}
        >
          {/* Back Button - Top Left */}
          <button
            onClick={() => setIsProfileSheetOpen(false)}
            className="absolute top-4 left-4 z-10 p-2 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 transition-colors"
            aria-label={t.closeProfile}
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>

          <div className="space-y-6 px-4 pt-12 pb-8">
            <Card className="border-white/20 bg-black">
              <CardContent className="space-y-6 pt-6">
                {/* Profile Picture */}
                <div className="flex justify-center">
                  <button
                    onClick={handleProfilePictureChange}
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <Avatar className="w-24 h-24 border-2 border-white/20">
                      <AvatarImage src={profilePic || "/default_pfp.png"} />
                      <AvatarFallback className="bg-white/10 text-white text-2xl">
                        {username.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </div>

                {/* Username */}
                <div className="space-y-2">
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="bg-black border-white/20 text-white"
                    placeholder={t.username}
                  />
                </div>

                {/* Wallet Address */}
                <div className="space-y-2">
                  <div 
                    onClick={handleCopyWalletAddress}
                    className="p-4 bg-white/5 border border-white/10 rounded-lg cursor-pointer hover:bg-white/10 transition-colors relative"
                  >
                    <code className="text-sm text-white/80 font-mono truncate block pr-20">
                      {walletAddress 
                        ? `${walletAddress.substring(0, 8)}...${walletAddress.substring(walletAddress.length - 8)}`
                        : "Wallet address will be available after registration..."}
                    </code>
                    <div 
                      onClick={handleOpenStellarExpert}
                      className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 text-white/60 hover:text-white cursor-pointer"
                    >
                      <Wallet className="w-3 h-3" />
                      <span className="text-xs">{t.addy}</span>
                    </div>
                  </div>
                  {walletAddress && (
                    <p className="text-xs text-white/60 mt-2">
                      {t.fundYourAddress}
                    </p>
                  )}
                </div>

                {/* Language Selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Globe className="w-4 h-4 text-white" />
                    <span className="text-sm text-white/80">{t.language}</span>
                  </div>
                  <div className="flex justify-center gap-4">
                    <Button
                      variant="outline"
                      onClick={() => handleLanguageChange("es")}
                      className={`border-2 bg-transparent ${language === "es" ? "border-white text-white" : "border-white/20 text-white/60"} hover:bg-white/10`}
                    >
                      ES
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleLanguageChange("en")}
                      className={`border-2 bg-transparent ${language === "en" ? "border-white text-white" : "border-white/20 text-white/60"} hover:bg-white/10`}
                    >
                      EN
                    </Button>
                  </div>
                </div>

                {/* Currency Selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Wallet className="w-4 h-4 text-white" />
                    <span className="text-sm text-white/80">{t.currency}</span>
                  </div>
                  <p className="text-xs text-white/60 text-center mb-2">{t.currencyDesc}</p>
                  <div className="flex flex-col justify-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleCurrencyChange("XLM")}
                      className={`border-2 bg-transparent w-full ${currency === "XLM" ? "border-white text-white" : "border-white/20 text-white/60"} hover:bg-white/10`}
                    >
                      {t.xlm}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleCurrencyChange("USD")}
                      className={`border-2 bg-transparent w-full ${currency === "USD" ? "border-white text-white" : "border-white/20 text-white/60"} hover:bg-white/10`}
                    >
                      {t.usd}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleCurrencyChange("ARS")}
                      className={`border-2 bg-transparent w-full ${currency === "ARS" ? "border-white text-white" : "border-white/20 text-white/60"} hover:bg-white/10`}
                    >
                      {t.ars}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Logout Button */}
            <div className="relative">
              <button
                onClick={handleLogout}
                className="absolute right-0 flex items-center gap-1 text-white/60 hover:text-white cursor-pointer"
                aria-label={t.logout}
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

