"use client"

import { useEffect, useState, useRef } from "react"
import { Wallet, Award, ArrowLeft, Globe, LogOut, Bell, FileText, Link2, ExternalLink, X, TrendingUp, MessageCircle, Send, Copy, Check } from "lucide-react"
import { FallingPattern } from "@/components/ui/falling-pattern"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { SlidingNumber } from "@/components/ui/sliding-number"
import { AnimatedARSBalance } from "@/components/ui/animated-ars-balance"
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
  const [referralLoading, setReferralLoading] = useState(false)
  const [referralStats, setReferralStats] = useState<{
    totalReferrals: number
    totalPointsEarned: number
  } | null>(null)
  const [inviteCodeCopied, setInviteCodeCopied] = useState(false)
  
  // Balance Audit state
  const [isBalanceAuditOpen, setIsBalanceAuditOpen] = useState(false)
  const [apyValue, setApyValue] = useState<number | null>(null)
  const [apyLoading, setApyLoading] = useState(true)
  
  // Notifications state (from credit-request)
  const [notifications, setNotifications] = useState<Array<{
    id: string
    type: string
    title: string
    message: string
    read: boolean
    created_at: string
  }>>([])
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  
  // EVM Address state (from main)
  const [evmAddress, setEvmAddress] = useState<string | null>(null)
  const [isEvmDialogOpen, setIsEvmDialogOpen] = useState(false)
  const [evmInput, setEvmInput] = useState("")
  const [evmLoading, setEvmLoading] = useState(false)
  const [maxflowEgoScore, setMaxflowEgoScore] = useState<any | null>(null)
  const [maxflowLoading, setMaxflowLoading] = useState(false)
  
  // Profile state
  const [username, setUsername] = useState("")
  const [walletAddress, setWalletAddress] = useState("")
  const [walletNetwork, setWalletNetwork] = useState<"testnet" | "mainnet">("testnet")
  const [language, setLanguage] = useState<"es" | "en">("es")
  const [profilePic, setProfilePic] = useState<string | null>("/capybara_pfp.png")
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
  const [isEstablishingTrustline, setIsEstablishingTrustline] = useState(false)

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
          // Ensure APY is a number
          const apyNumber = typeof defindexData.apy === 'number' 
            ? defindexData.apy 
            : Number(defindexData.apy) || 15.5
          
          setDefindexBalance({
            walletBalance: defindexData.walletBalance,
            strategyBalance: defindexData.strategyBalance,
            totalBalance: defindexData.balance,
            strategyShares: defindexData.strategyShares,
            apy: apyNumber,
          })
          // Set APY value for balance audit modal
          if (apyNumber) {
            setApyValue(apyNumber)
            setApyLoading(false)
          }
        }
      } else {
        console.warn("[Wallet] Failed to fetch DeFindex balance:", defindexResponse.status)
      }
    } catch (error) {
      console.error("[Wallet] Error fetching DeFindex balance:", error)
    }
  }

  // Function to fetch APY data
  const fetchAPY = async (userId: string) => {
    try {
      setApyLoading(true)
      const apyResponse = await fetch("/api/wallet/defindex/apy", {
        headers: {
          "x-user-id": userId,
        },
      })

      if (apyResponse.ok) {
        const apyData = await apyResponse.json()
        if (apyData.success && apyData.apy) {
          // APY API returns an object with 'precise' (number) or 'primary' (string)
          // Extract the numeric value
          const apyNumber = typeof apyData.apy === 'object' 
            ? (apyData.apy.precise ?? Number(apyData.apy.primary) ?? null)
            : Number(apyData.apy) || null
          
          if (apyNumber !== null && !isNaN(apyNumber)) {
            setApyValue(apyNumber)
          }
        }
      }
    } catch (error) {
      console.error("[Wallet] Error fetching APY:", error)
    } finally {
      setApyLoading(false)
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
      ars: "ARS",
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
      inviteCodeDesc: "Comparte este código con nuevos usuarios. Cuando se registren usando tu código, recibirás 1 punto de confianza.",
      copyCode: "Copiar Código",
      codeCopied: "Código copiado al portapapeles",
      copyInviteCode: "Copiar Código de Invitación",
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
      // EVM Address
      linkEvmAddress: "Vincular Dirección EVM",
      evmAddressTitle: "Dirección EVM para MaxFlow",
      evmAddressDesc: "Vincula tu dirección Ethereum para obtener tu puntuación de ego de MaxFlow",
      evmAddressPlaceholder: "0x...",
      linkAddress: "Vincular Dirección",
      unlinkAddress: "Desvincular",
      evmAddressLinked: "Dirección vinculada",
      evmAddressNotLinked: "No hay dirección vinculada",
      maxflowScore: "Puntuación MaxFlow",
      localHealth: "Salud Local",
      totalNodes: "Nodos Totales",
      acceptedUsers: "Usuarios Aceptados",
      loadingScore: "Cargando puntuación...",
      errorLoadingScore: "Error al cargar puntuación",
      evmAddressCopied: "Dirección copiada",
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
      ars: "ARS",
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
      inviteCodeDesc: "Share this code with new users. When they register using your code, you'll receive 1 trust point.",
      copyCode: "Copy Code",
      codeCopied: "Code copied to clipboard",
      copyInviteCode: "Copy Invite Code",
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
      // EVM Address
      linkEvmAddress: "Link EVM Address",
      evmAddressTitle: "EVM Address for MaxFlow",
      evmAddressDesc: "Link your Ethereum address to get your MaxFlow ego score",
      evmAddressPlaceholder: "0x...",
      linkAddress: "Link Address",
      unlinkAddress: "Unlink",
      evmAddressLinked: "Address linked",
      evmAddressNotLinked: "No address linked",
      maxflowScore: "MaxFlow Score",
      localHealth: "Local Health",
      totalNodes: "Total Nodes",
      acceptedUsers: "Accepted Users",
      loadingScore: "Loading score...",
      errorLoadingScore: "Error loading score",
      evmAddressCopied: "Address copied",
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
            // Default to 0 trust points if fetch fails (new users start with 0)
            setTrustPoints({ balance: 0, last_daily_credit: null })
          }
          
          // Fetch referral code and stats
          try {
            setReferralLoading(true)
            const referralStatusResponse = await fetch("/api/wallet/referral/status", {
              headers: {
                "x-user-id": userId,
              },
            })
            
            if (referralStatusResponse.ok) {
              const referralData = await referralStatusResponse.json()
              if (referralData.success) {
                const code = referralData.referralCode || ""
                setInviteCode(code)
                setReferralStats({
                  totalReferrals: referralData.totalReferrals || 0,
                  totalPointsEarned: referralData.totalPointsEarned || 0,
                })
                
                // If no referral code exists, generate one
                if (!code) {
                  const generateResponse = await fetch("/api/wallet/referral/generate", {
                    method: "POST",
                    headers: {
                      "x-user-id": userId,
                    },
                  })
                  
                  if (generateResponse.ok) {
                    const generateData = await generateResponse.json()
                    if (generateData.success && generateData.referralCode) {
                      setInviteCode(generateData.referralCode)
                    }
                  }
                }
              } else {
                // If status fetch failed, try to generate
                const generateResponse = await fetch("/api/wallet/referral/generate", {
                  method: "POST",
                  headers: {
                    "x-user-id": userId,
                  },
                })
                
                if (generateResponse.ok) {
                  const generateData = await generateResponse.json()
                  if (generateData.success && generateData.referralCode) {
                    setInviteCode(generateData.referralCode)
                  }
                }
              }
            } else {
              // If status fetch failed, try to generate
              const generateResponse = await fetch("/api/wallet/referral/generate", {
                method: "POST",
                headers: {
                  "x-user-id": userId,
                },
              })
              
              if (generateResponse.ok) {
                const generateData = await generateResponse.json()
                if (generateData.success && generateData.referralCode) {
                  setInviteCode(generateData.referralCode)
                }
              }
            }
          } catch (referralError) {
            console.error("[Wallet] Error fetching referral data:", referralError)
          } finally {
            setReferralLoading(false)
          }
          
          // Fetch notifications
          const notificationsResponse = await fetch("/api/wallet/notifications", {
            headers: {
              "x-user-id": userId,
            },
          })
          
          if (notificationsResponse.ok) {
            const notificationsData = await notificationsResponse.json()
            const newNotifications = notificationsData.notifications || []
            const previousUnreadCount = unreadCount
            setNotifications(newNotifications)
            const unread = newNotifications.filter((n: any) => !n.read).length
            setUnreadCount(unread)
            
            // Play notification sound if there are new unread notifications
            if (unread > previousUnreadCount && typeof window !== "undefined") {
              try {
                const audio = new Audio("/sound/KREAEM_percussion_one_shot_falling_wood.wav")
                audio.volume = 0.3
                audio.play().catch(err => console.log("[Wallet] Could not play notification sound:", err))
              } catch (err) {
                console.log("[Wallet] Error creating notification sound:", err)
              }
            }
          }
          
          // Fetch APY
          const apyResponse = await fetch("/api/wallet/defindex/apy", {
            headers: {
              "x-user-id": userId,
            },
          })
          
          if (apyResponse.ok) {
            const apyData = await apyResponse.json()
            if (apyData.success && apyData.apy) {
              setApyValue(apyData.apy.primary || apyData.apy.apy || null)
            }
          }
          setApyLoading(false)
          
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
            // Load profile picture from database
            if (profileData.profile && profileData.profile.profile_picture) {
              setProfilePic(profileData.profile.profile_picture)
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

                  // Fetch DeFindex balance, auto-deposit status, and APY
                  fetchDefindexBalance(userId)
                  fetchAutoDepositStatus(userId)
                  fetchAPY(userId)
                  
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

          // Fetch EVM address
          const evmResponse = await fetch("/api/wallet/evm-address", {
            headers: {
              "x-user-id": userId,
            },
          })
          if (evmResponse.ok) {
            const evmData = await evmResponse.json()
            setEvmAddress(evmData.evmAddress || null)
          }
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

  // Fetch MaxFlow ego score when EVM address is available
  useEffect(() => {
    const fetchMaxFlowScore = async () => {
      if (!evmAddress) {
        setMaxflowEgoScore(null)
        return
      }

      setMaxflowLoading(true)
      try {
        const userId = sessionStorage.getItem("dev_username")
        if (!userId) return

        const response = await fetch(`/api/maxflow/ego/${evmAddress}/score`, {
          headers: {
            "x-user-id": userId,
          },
        })

        if (response.ok) {
          const data = await response.json()
          setMaxflowEgoScore(data.egoScore)
        } else {
          console.error("[Wallet] Error fetching MaxFlow score:", response.status)
          setMaxflowEgoScore(null)
        }
      } catch (error) {
        console.error("[Wallet] Error fetching MaxFlow score:", error)
        setMaxflowEgoScore(null)
      } finally {
        setMaxflowLoading(false)
      }
    }

    fetchMaxFlowScore()
  }, [evmAddress])


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

  // Format balance - show no decimals if balance is 0
  const formatBalance = (value: number, decimals: number = 4) => {
    if (value === 0) {
      return "0"
    }
    return value.toFixed(decimals)
  }
  
  const balance = formatBalance(animatedBalance, 4)
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
    try {
      const userId = sessionStorage.getItem("dev_username")
      if (!userId) return
      
      const response = await fetch("/api/wallet/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({
          username,
          display_name: username,
          profile_picture: profilePic,
        }),
      })
      
      const data = await response.json()
      
      if (response.ok && data.profile) {
        // Update profile picture if saved
        if (data.profile.profile_picture) {
          setProfilePic(data.profile.profile_picture)
        }
        alert(t.language === "es" ? "Perfil guardado exitosamente" : "Profile saved successfully")
        setIsProfileSheetOpen(false)
      } else {
        alert(t.language === "es" 
          ? `Error al guardar perfil: ${data.error || "Error desconocido"}` 
          : `Error saving profile: ${data.error || "Unknown error"}`
        )
      }
    } catch (error) {
      console.error("[Wallet] Error saving profile:", error)
      alert(t.language === "es" ? "Error al guardar perfil" : "Error saving profile")
    }
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

  const handleLinkEvmAddress = async () => {
    if (!evmInput.trim()) {
      alert(t.language === "es" ? "Por favor ingresa una dirección EVM" : "Please enter an EVM address")
      return
    }

    setEvmLoading(true)
    try {
      const userId = sessionStorage.getItem("dev_username")
      if (!userId) {
        throw new Error(t.notAuthenticated)
      }

      const response = await fetch("/api/wallet/evm-address", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({
          evmAddress: evmInput.trim(),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || t.errorLoadingScore)
      }

      const data = await response.json()
      setEvmAddress(data.evmAddress)
      setEvmInput("")
      setIsEvmDialogOpen(false)
    } catch (error) {
      alert(error instanceof Error ? error.message : t.errorLoadingScore)
    } finally {
      setEvmLoading(false)
    }
  }

  const handleUnlinkEvmAddress = async () => {
    if (!window.confirm(t.language === "es" ? "¿Estás seguro de que quieres desvincular esta dirección?" : "Are you sure you want to unlink this address?")) {
      return
    }

    setEvmLoading(true)
    try {
      const userId = sessionStorage.getItem("dev_username")
      if (!userId) {
        throw new Error(t.notAuthenticated)
      }

      const response = await fetch("/api/wallet/evm-address", {
        method: "DELETE",
        headers: {
          "x-user-id": userId,
        },
      })

      if (!response.ok) {
        throw new Error(t.errorLoadingScore)
      }

      setEvmAddress(null)
      setMaxflowEgoScore(null)
    } catch (error) {
      alert(error instanceof Error ? error.message : t.errorLoadingScore)
    } finally {
      setEvmLoading(false)
    }
  }

  const handleCopyEvmAddress = () => {
    if (evmAddress) {
      navigator.clipboard.writeText(evmAddress)
      alert(t.evmAddressCopied)
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

  const handleOpenStellarExpert = async (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering copy when clicking icon
    if (!walletAddress) {
      console.warn("Cannot open Stellar Expert: wallet address not available yet")
      return
    }
    
    // Establish USDC trustline first
    setIsEstablishingTrustline(true)
    try {
      const userId = sessionStorage.getItem("dev_username")
      if (!userId) {
        console.warn("Cannot establish trustline: user ID not found")
        // Still open Stellar Expert even if trustline fails
        setIsEstablishingTrustline(false)
        openStellarExpert()
        return
      }

      console.log("[Wallet] Establishing USDC trustline...")
      const response = await fetch("/api/wallet/stellar/trustline", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        console.error("[Wallet] Trustline API error:", errorData)
        throw new Error(errorData.error || "Failed to establish trustline")
      }

      const result = await response.json()
      
      if (result.success) {
        console.log("[Wallet] ✅ USDC trustline established successfully")
        if (result.transactionHash) {
          console.log("[Wallet] Transaction hash:", result.transactionHash)
          // Show success message to user
          alert(t.language === "es" 
            ? `✅ Trustline USDC establecido exitosamente\nHash: ${result.transactionHash.substring(0, 8)}...`
            : `✅ USDC trustline established successfully\nHash: ${result.transactionHash.substring(0, 8)}...`
          )
        } else {
          console.log("[Wallet] Trustline already exists")
        }
      } else {
        console.error("[Wallet] Trustline establishment failed:", result.error)
        throw new Error(result.error || "Failed to establish trustline")
      }
    } catch (error: any) {
      console.error("[Wallet] Error establishing trustline:", error)
      // Show error message to user
      alert(t.language === "es"
        ? `❌ Error al establecer trustline USDC: ${error.message || "Error desconocido"}\n\nAsegúrate de tener suficiente XLM para pagar las tarifas de transacción.`
        : `❌ Error establishing USDC trustline: ${error.message || "Unknown error"}\n\nMake sure you have enough XLM to pay transaction fees.`
      )
      // Still open Stellar Expert even if trustline fails
    } finally {
      setIsEstablishingTrustline(false)
      // Open Stellar Expert after trustline is established (or if it fails)
      openStellarExpert()
    }
  }

  const openStellarExpert = () => {
    if (!walletAddress) return
    
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
          <div className="mb-8 relative">
            <div className="border border-white/20 rounded-lg p-8 text-center relative">
              <div className="text-sm text-white/60 mb-4">{t.totalBalance} ({getCurrencySymbol()})</div>
              <div
                className="text-6xl font-bold text-white cursor-pointer select-none flex items-center justify-center min-h-[4rem]"
                onClick={toggleBalanceVisibility}
              >
                {isBalanceLoading && xlmBalance === null ? (
                  <span className="tabular-nums">----</span>
                ) : isBalanceVisible ? (
                  currency === "ARS" ? (
                    <AnimatedARSBalance
                      initialBalance={animatedBalance / (usdToArsRate || 900)} // Convert ARS back to USD
                      usdToArsRate={usdToArsRate || 900}
                      apy={defindexBalance?.apy || 15.5}
                      isVisible={isBalanceVisible}
                    />
                  ) : (
                    <SlidingNumber value={animatedBalance} />
                  )
                ) : (
                  <span className="tabular-nums">{maskedBalance}</span>
                )}
              </div>
              {/* Real-time APY Display - Clickable */}
              <div className="mt-2">
                <button
                  onClick={() => {
                    setIsBalanceAuditOpen(true)
                    // Fetch APY if not already loaded
                    if (apyLoading && typeof window !== "undefined") {
                      const userId = sessionStorage.getItem("dev_username")
                      if (userId) {
                        fetchAPY(userId)
                      }
                    }
                  }}
                  className="flex items-center justify-center gap-2 text-green-400 hover:text-green-300 transition-colors cursor-pointer"
                  aria-label="View Balance Audit"
                >
                  <TrendingUp className="w-4 h-4" />
                  <span className="font-semibold">
                    {apyLoading ? "..." : (typeof apyValue === 'number' && !isNaN(apyValue)) ? `${apyValue.toFixed(2)}%` : (typeof defindexBalance?.apy === 'number' && !isNaN(defindexBalance.apy)) ? `${defindexBalance.apy.toFixed(2)}%` : "15.50%"}
                  </span>
                </button>
              </div>
            </div>
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
              {trustPoints?.balance ?? 0} TRUST
            </span>
          </div>
        </button>

        {/* Wallet Icon - Bottom Right */}
        <button
          onClick={() => setIsProfileSheetOpen(true)}
          className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-10"
          aria-label={t.openProfile}
        >
          <div className="w-16 h-16 md:w-14 md:h-14 flex items-center justify-center transition-colors cursor-pointer relative">
            <Wallet className="w-7 h-7 md:w-6 md:h-6 text-white" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs text-white font-bold">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
        </button>
      </div>

      {/* Trust Points Modal */}
      <Dialog open={isTrustModalOpen} onOpenChange={setIsTrustModalOpen}>
        <DialogContent className="bg-black/80 backdrop-blur-md border-white/20 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white text-2xl">{t.trustPointsTitle}</DialogTitle>
            <DialogDescription className="text-white/60">
              {t.currentBalance} <span className="font-bold text-white">{trustPoints?.balance ?? 0} TRUST</span>
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
                  <li>{t.inviteUsers}</li>
                  <li>{t.receivePoints}</li>
                </ul>
                {referralStats && (
                  <div className="mt-4 p-3 bg-white/5 border border-white/10 rounded-lg">
                    <div className="text-sm text-white/60">Referidos exitosos: <span className="text-white font-semibold">{referralStats.totalReferrals}</span></div>
                    <div className="text-sm text-white/60">Puntos ganados: <span className="text-white font-semibold">{referralStats.totalPointsEarned}</span></div>
                  </div>
                )}
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

              {referralLoading ? (
                <div className="p-4 bg-white/5 border border-white/10 rounded-lg text-white/60 text-center">
                  {t.language === "es" ? "Cargando código de referido..." : "Loading referral code..."}
                </div>
              ) : inviteCode ? (
                <>
                  {/* Copy Invite Code Button - combines message and URL */}
                  <Button
                    onClick={async () => {
                      try {
                        // Create invite link
                        const inviteLink = typeof window !== "undefined" 
                          ? `${window.location.origin}/auth?invite=${inviteCode}`
                          : `https://sozucredit.com/auth?invite=${inviteCode}`
                        
                        // Create social media ready message with invite code and URL
                        // Replace {code} and {link} placeholders, then append link only if {link} wasn't in template
                        let inviteMessage = t.inviteMessage
                          .replace("{code}", inviteCode)
                          .replace("{link}", inviteLink)
                        
                        // Only append link if {link} placeholder wasn't in the original template
                        if (!t.inviteMessage.includes("{link}")) {
                          inviteMessage += `\n\n${inviteLink}`
                        }
                        
                        // Copy combined message and URL to clipboard
                        await navigator.clipboard.writeText(inviteMessage)
                        
                        // Show success animation
                        setInviteCodeCopied(true)
                        setTimeout(() => setInviteCodeCopied(false), 2000)
                      } catch (err) {
                        // Fallback: just copy the code if copy fails
                        await navigator.clipboard.writeText(inviteCode)
                        setInviteCodeCopied(true)
                        setTimeout(() => setInviteCodeCopied(false), 2000)
                      }
                    }}
                    variant="outline"
                    className="w-full border-2 border-white bg-transparent text-white hover:bg-white/10 font-semibold transition-all duration-200"
                  >
                    <div className="flex items-center justify-center gap-2">
                      {inviteCodeCopied ? (
                        <>
                          <Check className="w-4 h-4 animate-in fade-in zoom-in duration-200" />
                          <span>{t.language === "es" ? "¡Copiado!" : "Copied!"}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>{t.copyInviteCode}</span>
                        </>
                      )}
                    </div>
                  </Button>

                  {/* Social Media Share Buttons */}
                  <div className="flex gap-2 justify-center">
                    {/* Twitter */}
                    <button
                      onClick={() => {
                        const inviteLink = typeof window !== "undefined" 
                          ? `${window.location.origin}/auth?invite=${inviteCode}`
                          : `https://sozucredit.com/auth?invite=${inviteCode}`
                        const text = encodeURIComponent(t.inviteMessage.replace("{code}", inviteCode).replace("{link}", inviteLink))
                        window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(inviteLink)}`, '_blank')
                      }}
                      className="p-2 border border-white/20 rounded-lg hover:bg-white/10 transition-colors"
                      aria-label="Share on Twitter"
                    >
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                    </button>

                    {/* Telegram */}
                    <button
                      onClick={() => {
                        const inviteLink = typeof window !== "undefined" 
                          ? `${window.location.origin}/auth?invite=${inviteCode}`
                          : `https://sozucredit.com/auth?invite=${inviteCode}`
                        const text = encodeURIComponent(t.inviteMessage.replace("{code}", inviteCode).replace("{link}", inviteLink) + `\n\n${inviteLink}`)
                        window.open(`https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${text}`, '_blank')
                      }}
                      className="p-2 border border-white/20 rounded-lg hover:bg-white/10 transition-colors"
                      aria-label="Share on Telegram"
                    >
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                      </svg>
                    </button>

                    {/* WhatsApp */}
                    <button
                      onClick={() => {
                        const inviteLink = typeof window !== "undefined" 
                          ? `${window.location.origin}/auth?invite=${inviteCode}`
                          : `https://sozucredit.com/auth?invite=${inviteCode}`
                        const text = encodeURIComponent(t.inviteMessage.replace("{code}", inviteCode).replace("{link}", inviteLink) + `\n\n${inviteLink}`)
                        window.open(`https://wa.me/?text=${text}`, '_blank')
                      }}
                      className="p-2 border border-white/20 rounded-lg hover:bg-white/10 transition-colors"
                      aria-label="Share on WhatsApp"
                    >
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.98 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                      </svg>
                    </button>
                  </div>
                </>
              ) : (
                <div className="p-4 bg-white/5 border border-white/10 rounded-lg text-white/60 text-center">
                  {t.language === "es" ? "No se pudo cargar el código de referido" : "Failed to load referral code"}
                </div>
              )}

              <Button
                onClick={() => setModalView("main")}
                variant="outline"
                className="w-full border-2 border-white/30 bg-transparent text-white hover:bg-white/20 hover:border-white/50 hover:text-white"
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
                    max={trustPoints?.balance ?? 0}
                    value={vouchPoints}
                    onChange={(e) => setVouchPoints(e.target.value)}
                    className="bg-black border-white/20 text-white"
                    placeholder="1"
                  />
                  <p className="text-xs text-white/60">
                    {t.available} {trustPoints?.balance ?? 0} TRUST
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
                      <AvatarImage src={profilePic || "/capybara_pfp.png"} />
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
                      className={`absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 text-white/60 hover:text-white cursor-pointer ${isEstablishingTrustline ? "opacity-50 cursor-wait" : ""}`}
                    >
                      {isEstablishingTrustline ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs">{t.language === "es" ? "Configurando..." : "Setting up..."}</span>
                        </>
                      ) : (
                        <>
                          <Wallet className="w-3 h-3" />
                          <span className="text-xs">{t.addy}</span>
                        </>
                      )}
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
                  <div className="flex flex-row justify-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleCurrencyChange("XLM")}
                      className={`border-2 bg-transparent flex-1 ${currency === "XLM" ? "border-white text-white" : "border-white/20 text-white/60"} hover:bg-white/10`}
                    >
                      {t.xlm}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleCurrencyChange("USD")}
                      className={`border-2 bg-transparent flex-1 ${currency === "USD" ? "border-white text-white" : "border-white/20 text-white/60"} hover:bg-white/10`}
                    >
                      {t.usd}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleCurrencyChange("ARS")}
                      className={`border-2 bg-transparent flex-1 ${currency === "ARS" ? "border-white text-white" : "border-white/20 text-white/60"} hover:bg-white/10`}
                    >
                      {t.ars}
                    </Button>
                  </div>
                </div>

                {/* EVM Address Section */}
                <div className="space-y-2 pt-4 border-t border-white/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-white" />
                      <span className="text-sm text-white/80">{t.linkEvmAddress}</span>
                    </div>
                    {evmAddress && (
                      <button
                        onClick={handleUnlinkEvmAddress}
                        disabled={evmLoading}
                        className="text-xs text-white/60 hover:text-white/80 transition-colors"
                      >
                        {t.unlinkAddress}
                      </button>
                    )}
                  </div>
                  
                  {evmAddress ? (
                    <div className="space-y-2">
                      <div 
                        onClick={handleCopyEvmAddress}
                        className="p-4 bg-white/5 border border-white/10 rounded-lg cursor-pointer hover:bg-white/10 transition-colors relative"
                      >
                        <code className="text-sm text-white/80 font-mono truncate block pr-20">
                          {`${evmAddress.substring(0, 8)}...${evmAddress.substring(evmAddress.length - 8)}`}
                        </code>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 text-white/60 hover:text-white cursor-pointer">
                          <ExternalLink className="w-3 h-3" />
                          <span className="text-xs">{t.evmAddressCopied}</span>
                        </div>
                      </div>
                      
                      {/* MaxFlow Ego Score */}
                      {maxflowLoading ? (
                        <div className="p-4 bg-white/5 border border-white/10 rounded-lg text-center">
                          <p className="text-sm text-white/60">{t.loadingScore}</p>
                        </div>
                      ) : maxflowEgoScore ? (
                        <div className="p-4 bg-white/5 border border-white/10 rounded-lg space-y-2">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-white">{t.maxflowScore}</span>
                          </div>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-white/60">{t.localHealth}:</span>
                              <span className="text-white font-medium">{maxflowEgoScore.localHealth.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-white/60">{t.totalNodes}:</span>
                              <span className="text-white font-medium">{maxflowEgoScore.metrics.totalNodes}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-white/60">{t.acceptedUsers}:</span>
                              <span className="text-white font-medium">{maxflowEgoScore.metrics.acceptedUsers}</span>
                            </div>
                            {maxflowEgoScore.metrics.avgResidualFlow > 0 && (
                              <div className="flex justify-between">
                                <span className="text-white/60">Avg Flow:</span>
                                <span className="text-white font-medium">{maxflowEgoScore.metrics.avgResidualFlow.toFixed(2)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 bg-white/5 border border-white/10 rounded-lg text-center">
                          <p className="text-sm text-white/60">{t.errorLoadingScore}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsEvmDialogOpen(true)}
                      className="w-full p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors text-left"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-white/80">{t.evmAddressNotLinked}</span>
                        <Link2 className="w-4 h-4 text-white/60" />
                      </div>
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Notifications and Logout Buttons */}
            <div className="relative flex items-center justify-between">
              <button
                onClick={() => {
                  setIsProfileSheetOpen(false)
                  setIsNotificationsOpen(true)
                }}
                className="flex items-center gap-2 p-3 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 transition-colors relative"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5 text-white" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs text-white font-bold">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 text-white/60 hover:text-white cursor-pointer"
                aria-label={t.logout}
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Notifications Dialog */}
      <Dialog open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
        <DialogContent className="bg-black/80 backdrop-blur-md border-white/20 text-white max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white text-2xl">Notifications</DialogTitle>
            <DialogDescription className="text-white/60">
              {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : "No unread notifications"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
            {notifications.length === 0 ? (
              <p className="text-white/60 text-center py-8">No notifications yet</p>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 rounded-lg border cursor-pointer ${
                    notification.read
                      ? "bg-white/5 border-white/10"
                      : "bg-white/10 border-white/20"
                  }`}
                  onClick={async () => {
                    if (!notification.read) {
                      // Mark as read
                      const userId = sessionStorage.getItem("dev_username")
                      if (userId) {
                        await fetch("/api/wallet/notifications", {
                          method: "PUT",
                          headers: {
                            "Content-Type": "application/json",
                            "x-user-id": userId,
                          },
                          body: JSON.stringify({
                            notificationId: notification.id,
                            read: true,
                          }),
                        })
                        
                        // Update local state
                        setNotifications(notifications.map(n => 
                          n.id === notification.id ? { ...n, read: true } : n
                        ))
                        setUnreadCount(Math.max(0, unreadCount - 1))
                      }
                    }
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-white">{notification.title}</h4>
                      <p className="text-sm text-white/80 mt-1">{notification.message}</p>
                      <p className="text-xs text-white/60 mt-2">
                        {new Date(notification.created_at).toLocaleDateString()} {new Date(notification.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full ml-2 mt-1" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Balance Audit Modal */}
      <Dialog open={isBalanceAuditOpen} onOpenChange={setIsBalanceAuditOpen}>
        <DialogContent className="bg-black/80 backdrop-blur-md border-white/20 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white text-2xl">
              {t.language === "es" ? "Auditoría de Balance" : "Balance Audit"}
            </DialogTitle>
            <DialogDescription className="text-white/60">
              {t.language === "es" ? "Desglose detallado de tu balance" : "Detailed breakdown of your balance"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {defindexBalance ? (
              <>
                <div className="space-y-3">
                  {/* Wallet Balance */}
                  <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/10">
                    <span className="text-white/80">
                      {t.language === "es" ? "Billetera" : "Wallet"}:
                    </span>
                    <span className="text-white font-medium text-lg">
                      ${defindexBalance.walletBalance === 0 ? "0" : defindexBalance.walletBalance.toFixed(2)} USDC
                    </span>
                  </div>

                  {/* Strategy Balance */}
                  <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/10">
                    <span className="text-white/80">
                      {t.language === "es" ? "Estrategia DeFi" : "DeFi Strategy"}:
                    </span>
                    <span className="text-green-400 font-medium text-lg">
                      ${defindexBalance.strategyBalance === 0 ? "0" : defindexBalance.strategyBalance.toFixed(2)} USDC
                    </span>
                  </div>

                  {/* Total Balance */}
                  <div className="flex justify-between items-center p-4 bg-white/10 rounded-lg border-2 border-white/20">
                    <span className="text-white font-semibold">
                      {t.language === "es" ? "Total" : "Total"}:
                    </span>
                    <span className="text-white font-bold text-xl">
                      ${defindexBalance.totalBalance === 0 ? "0" : defindexBalance.totalBalance.toFixed(2)} USDC
                    </span>
                  </div>

                  {/* Shares */}
                  {defindexBalance.strategyShares > 0 && (
                    <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/10">
                      <span className="text-white/60 text-sm">
                        {t.language === "es" ? "Acciones" : "Shares"}:
                      </span>
                      <span className="text-white/80 text-sm">
                        {defindexBalance.strategyShares.toFixed(4)}
                      </span>
                    </div>
                  )}

                </div>

                {/* APY and View Blend Strategy Button */}
                <div className="mt-4 pt-4 border-t border-white/20">
                  <button
                    onClick={() => {
                      window.open('https://mainnet.blend.capital/asset/?poolId=CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD&assetId=CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75', '_blank')
                    }}
                    className="w-full py-3 px-4 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      <span>{t.language === "es" ? "Ver Estrategia Blend" : "View Blend Strategy"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span>
                        {apyLoading ? "..." : (typeof apyValue === 'number' && !isNaN(apyValue)) ? `${apyValue.toFixed(2)}` : (typeof defindexBalance?.apy === 'number' && !isNaN(defindexBalance.apy)) ? `${defindexBalance.apy.toFixed(2)}` : "15.50"}
                      </span>
                      <span>%</span>
                      <span>APY</span>
                    </div>
                  </button>
                </div>
              </>
            ) : (
              <p className="text-white/60 text-center py-8">
                {t.language === "es" ? "No hay datos de balance disponibles" : "No balance data available"}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* EVM Address Dialog */}
      <Dialog open={isEvmDialogOpen} onOpenChange={setIsEvmDialogOpen}>
        <DialogContent className="bg-black/80 backdrop-blur-md border-white/20 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white text-2xl">{t.evmAddressTitle}</DialogTitle>
            <DialogDescription className="text-white/60">
              {t.evmAddressDesc}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="evmAddress" className="text-white">
                {t.evmAddressTitle}
              </Label>
              <Input
                id="evmAddress"
                value={evmInput}
                onChange={(e) => setEvmInput(e.target.value)}
                placeholder={t.evmAddressPlaceholder}
                className="bg-black border-white/20 text-white font-mono"
              />
              <p className="text-xs text-white/60">
                {t.language === "es" 
                  ? "Ingresa tu dirección Ethereum (0x...)" 
                  : "Enter your Ethereum address (0x...)"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleLinkEvmAddress}
                disabled={evmLoading || !evmInput.trim()}
                className="flex-1 bg-white text-black hover:bg-white/90"
              >
                {evmLoading ? (t.language === "es" ? "Vinculando..." : "Linking...") : t.linkAddress}
              </Button>
              <Button
                onClick={() => {
                  setIsEvmDialogOpen(false)
                  setEvmInput("")
                }}
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
              >
                {t.cancel}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

