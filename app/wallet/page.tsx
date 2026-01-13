"use client"

import { useEffect, useState, useRef } from "react"
import { motion } from "framer-motion"
import { QRCodeSVG } from "qrcode.react"
import { Wallet, Award, ArrowLeft, Globe, LogOut, Bell, FileText, Link2, ExternalLink, X, TrendingUp, MessageCircle, Send, Copy, Check, Eye, Key, ArrowUp, QrCode } from "lucide-react"
import { FallingPattern } from "@/components/ui/falling-pattern"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SlidingNumber } from "@/components/ui/sliding-number"
import { APYDisplay, APYBadge } from "@/components/defindex/apy-display"
import { WalletCreator } from "@/components/wallet-creator"
import { WalletSkeleton } from "@/components/ui/wallet-skeleton"

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

// QR Code Component
function QRCodeComponent({ walletAddress, walletNetwork }: { walletAddress: string; walletNetwork: "testnet" | "mainnet" }) {
  const userId = typeof window !== "undefined" ? sessionStorage.getItem("dev_username") || "" : ""
  // Format: Stellar payment URL with memo
  // Using web+stellar:pay format with memo
  const network = walletNetwork || "testnet"
  const usdcIssuer = network === "testnet" 
    ? "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5" 
    : "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
  // Format: web+stellar:pay?destination=ADDRESS&memo=MEMO&memo_type=text&asset_code=USDC&asset_issuer=ISSUER
  const paymentUrl = `web+stellar:pay?destination=${encodeURIComponent(walletAddress)}&memo=${encodeURIComponent(userId)}&memo_type=text&asset_code=USDC&asset_issuer=${encodeURIComponent(usdcIssuer)}`
  
  return <QRCodeSVG value={paymentUrl} size={256} level="H" />
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
  const [isQRCodeOpen, setIsQRCodeOpen] = useState(false)
  const [isProfileSheetOpen, setIsProfileSheetOpen] = useState(false)
  const [isSendModalOpen, setIsSendModalOpen] = useState(false)
  const [sendRecipient, setSendRecipient] = useState("")
  const [sendAmount, setSendAmount] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [sendStep, setSendStep] = useState<"recipient" | "amount">("recipient")
  const [resolvedRecipientAddress, setResolvedRecipientAddress] = useState<string | null>(null)
  const [isResolvingRecipient, setIsResolvingRecipient] = useState(false)
  const [isManualMode, setIsManualMode] = useState(false)
  const [sendMemo, setSendMemo] = useState("")
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [transactionHash, setTransactionHash] = useState<string | null>(null)
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
  
  // Profile state
  const [username, setUsername] = useState("")
  const [walletAddress, setWalletAddress] = useState("")
  const [walletNetwork, setWalletNetwork] = useState<"testnet" | "mainnet">("testnet")
  const [walletCopied, setWalletCopied] = useState(false)
  
  // Secret key state
  const [secretKey, setSecretKey] = useState<string | null>(null)
  const [isSecretKeyExposed, setIsSecretKeyExposed] = useState(false)
  const [secretKeyCopied, setSecretKeyCopied] = useState(false)
  
  // Account diagnostics state
  const [accountDiagnostics, setAccountDiagnostics] = useState<{
    xlmBalance: number | null
    hasTrustline: boolean
    network: "testnet" | "mainnet" | null
    usdcIssuer: string | null
  } | null>(null)
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false)
  
  // Currency state - USDC only (fixed)
  const [currency] = useState<"USDC">("USDC")
  const [xlmPriceUSD, setXlmPriceUSD] = useState<number | null>(null)
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
  const fetchWalletUSDCBalance = async (publicKey: string) => {
    if (!publicKey) {
      console.warn("[Wallet] No public key provided for USDC balance fetch")
      return
    }
    
    try {
      console.log("[Wallet] 🔍 Fetching USDC balance directly from Stellar wallet:", publicKey.substring(0, 10) + "...")
      const { getUSDCBalanceClientSide } = await import("@/lib/stellar/client-wallet")
      const balance = await getUSDCBalanceClientSide(publicKey)
      console.log("[Wallet] ✅ USDC wallet balance fetched from Stellar:", balance)
      
      // Update defindexBalance with the actual wallet USDC balance
      // This takes precedence over the API's wallet balance
      setDefindexBalance((prev) => {
        if (prev) {
          const updated = {
            ...prev,
            walletBalance: balance, // Update with actual wallet balance from Stellar
            totalBalance: balance + (prev.strategyBalance || 0), // Recalculate total
          }
          console.log("[Wallet] 📊 Updated balance state:", {
            walletBalance: updated.walletBalance,
            strategyBalance: updated.strategyBalance,
            totalBalance: updated.totalBalance,
          })
          return updated
        } else {
          // If defindexBalance doesn't exist yet, set it with wallet balance
          const newBalance = {
            walletBalance: balance,
            strategyBalance: 0,
            totalBalance: balance,
            strategyShares: 0,
            apy: 15.5,
          }
          console.log("[Wallet] 📊 Created new balance state:", newBalance)
          return newBalance
        }
      })
    } catch (error) {
      console.error("[Wallet] ❌ Error fetching USDC wallet balance:", error)
    }
  }

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
        console.log("[Wallet] DeFindex walletBalance:", defindexData.walletBalance)
        console.log("[Wallet] DeFindex strategyBalance:", defindexData.strategyBalance)
        console.log("[Wallet] DeFindex totalBalance:", defindexData.balance)
        
        if (defindexData.success) {
          // Ensure APY is a number
          const apyNumber = typeof defindexData.apy === 'number' 
            ? defindexData.apy 
            : Number(defindexData.apy) || 15.5
          
          // Update balance, but preserve walletBalance if it was already set by fetchWalletUSDCBalance
          setDefindexBalance((prev) => {
            const walletBalance = prev?.walletBalance !== undefined && prev.walletBalance > 0 
              ? prev.walletBalance // Use already-fetched wallet balance if available
              : (defindexData.walletBalance || 0) // Otherwise use API value
            
            const strategyBalance = defindexData.strategyBalance || 0
            const totalBalance = walletBalance + strategyBalance
            
            console.log("[Wallet] 📊 Setting DeFindex balance:", {
              walletBalance: walletBalance.toFixed(2) + " USDC (in wallet - available for sending)",
              strategyBalance: strategyBalance.toFixed(2) + " USDC (in DeFindex strategy - locked)",
              totalBalance: totalBalance.toFixed(2) + " USDC (total)",
              usingDirectFetch: prev?.walletBalance !== undefined && prev.walletBalance > 0,
              note: "Only wallet balance can be used for sending. Strategy balance is locked in DeFindex."
            })
            
            return {
              walletBalance,
              strategyBalance,
              totalBalance,
              strategyShares: defindexData.strategyShares || 0,
              apy: apyNumber,
            }
          })
          // Set APY value for balance audit modal
          if (apyNumber) {
            setApyValue(apyNumber)
            setApyLoading(false)
          }
        }
        // Mark balance loading as complete (even if no balance data)
        setIsBalanceLoading(false)
      } else {
        console.warn("[Wallet] Failed to fetch DeFindex balance:", defindexResponse.status)
        // Mark balance loading as complete even on error (so skeleton doesn't persist)
        setIsBalanceLoading(false)
      }
    } catch (error) {
      console.error("[Wallet] Error fetching DeFindex balance:", error)
      // Mark balance loading as complete even on error (so skeleton doesn't persist)
      setIsBalanceLoading(false)
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
  
  // Use English as default (language selection removed)
  const t = texts.en

  // Reset secret key exposure when profile sheet closes
  useEffect(() => {
    if (!isProfileSheetOpen) {
      setSecretKey(null)
      setIsSecretKeyExposed(false)
      setSecretKeyCopied(false)
    }
  }, [isProfileSheetOpen])

  // Fetch XLM price in USD (for reference, not used for USDC balance)
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        // Fetch XLM price in USD (using CoinGecko API)
        const xlmResponse = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd")
        if (xlmResponse.ok) {
          const xlmData = await xlmResponse.json()
          setXlmPriceUSD(xlmData.stellar?.usd || null)
        }

        // USDC is always 1:1 with USD, no conversion needed
      } catch (error) {
        console.error("[Wallet] Error fetching prices:", error)
        // Set fallback rate if API fails
        setXlmPriceUSD(0.11) // Approximate XLM price in USD
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
      
      // TEMPORARY: Bypass authentication in development mode
      const isDevMode = process.env.NODE_ENV === "development"
      
      const checkAuth = () => {
        const isAuthenticated = sessionStorage.getItem("dev_authenticated") === "true"
        
        // In dev mode, bypass auth check and set default userId if not present
        if (isDevMode) {
          console.log("[Wallet] 🚧 DEV MODE: Bypassing authentication")
          const existingUserId = sessionStorage.getItem("dev_username")
          if (!existingUserId) {
            // Set a default mock userId for dev mode
            const mockUserId = "dev-user-" + Date.now()
            sessionStorage.setItem("dev_username", mockUserId)
            sessionStorage.setItem("dev_authenticated", "true")
            console.log("[Wallet] 🚧 DEV MODE: Set mock userId:", mockUserId)
          }
          // Fetch vault data immediately in dev mode
          fetchVaultData()
          return
        }
        
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
          let userId = sessionStorage.getItem("dev_username")
          
          if (!userId) {
            // In dev mode, create a default userId if missing
            if (isDevMode) {
              const mockUserId = "dev-user-" + Date.now()
              sessionStorage.setItem("dev_username", mockUserId)
              sessionStorage.setItem("dev_authenticated", "true")
              console.log("[Wallet] 🚧 DEV MODE: Created mock userId:", mockUserId)
              userId = mockUserId
            } else {
              setError("User ID not found")
              setIsLoading(false)
              return
            }
          }
          
          // Use userId (either from sessionStorage or newly created mock)
          const finalUserId = userId
          
          if (!finalUserId) {
            setError("User ID not found")
            setIsLoading(false)
            return
          }
          
          // Fetch vault data from API
          const vaultResponse = await fetch("/api/wallet/vault", {
            headers: {
              "x-user-id": finalUserId,
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
              "x-user-id": finalUserId,
            },
          })
          
          if (trustResponse.ok) {
            const trustData = await trustResponse.json()
            setTrustPoints(trustData.trustPoints)
          } else {
            // Default to 0 trust points if fetch fails (new users start with 0)
            setTrustPoints({ balance: 0, last_daily_credit: null })
          }
          
          // Generate referral code if needed
          try {
            setReferralLoading(true)
            const generateResponse = await fetch("/api/wallet/referral/generate", {
              method: "POST",
              headers: {
                "x-user-id": finalUserId,
              },
            })
            
            if (generateResponse.ok) {
              const generateData = await generateResponse.json()
              if (generateData.success && generateData.referralCode) {
                setInviteCode(generateData.referralCode)
              }
            }
          } catch (referralError) {
            console.error("[Wallet] Error generating referral code:", referralError)
          } finally {
            setReferralLoading(false)
          }
          
          // Fetch notifications
          const notificationsResponse = await fetch("/api/wallet/notifications", {
            headers: {
              "x-user-id": finalUserId,
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
              "x-user-id": finalUserId,
            },
          })
          
          if (apyResponse.ok) {
            const apyData = await apyResponse.json()
            if (apyData.success && apyData.apy) {
              setApyValue(apyData.apy.primary || apyData.apy.apy || null)
            }
          }
          setApyLoading(false)
          
          // Get username from localStorage (set during auth)
          const storedUsername = localStorage.getItem("sozu_username")
          if (storedUsername) {
            setUsername(storedUsername)
          } else {
            // Fallback to user ID substring if no username found
            setUsername(finalUserId.substring(0, 8))
          }
          
          // Function to fetch XLM balance from Stellar wallet
          const fetchXLMBalance = async (publicKey: string) => {
            try {
              setIsBalanceLoading(true)
              console.log("[Wallet] Fetching XLM balance for wallet:", publicKey)
              const balanceResponse = await fetch("/api/wallet/stellar/balance", {
                headers: {
                  "x-user-id": finalUserId,
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
            console.log(`[Wallet] Fetching wallet address for userId: ${finalUserId} (attempt ${retryCount + 1})`)
            try {
              const walletAddressResponse = await fetch("/api/wallet/stellar/address", {
                method: "GET",
                headers: {
                  "Content-Type": "application/json",
                  "x-user-id": finalUserId, // Include userId for authentication in dev mode
                },
              })
              
              console.log(`[Wallet] Wallet address response status: ${walletAddressResponse.status}`)
              
              if (walletAddressResponse.ok) {
                const walletData = await walletAddressResponse.json()
                console.log("[Wallet] Wallet data received:", walletData)
                
                // Check if we have a derived keypair public key in sessionStorage
                // This takes precedence over database wallet address for non-custodial wallets
                const derivedPublicKey = sessionStorage.getItem("stellar_public_key")
                
                let publicKeyToUse = walletData.publicKey
                
                if (derivedPublicKey) {
                  console.log("[Wallet] Found derived public key in sessionStorage:", derivedPublicKey.substring(0, 10) + "...")
                  console.log("[Wallet] Database wallet address:", walletData.publicKey?.substring(0, 10) + "...")
                  
                  // Use derived public key if it exists (non-custodial wallet)
                  if (derivedPublicKey !== walletData.publicKey) {
                    console.log("[Wallet] ⚠️ Mismatch detected: Using derived keypair public key instead of database address")
                    console.log("[Wallet] Derived keypair:", derivedPublicKey)
                    console.log("[Wallet] Database address:", walletData.publicKey)
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
                  
                  // Fetch balances for this wallet
                  fetchXLMBalance(publicKeyToUse)
                  fetchWalletUSDCBalance(publicKeyToUse) // Fetch USDC directly from Stellar

                  // Fetch DeFindex balance, auto-deposit status, and APY
                  fetchDefindexBalance(finalUserId)
                  fetchAutoDepositStatus(finalUserId)
                  fetchAPY(finalUserId)
                  
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
                          "x-user-id": finalUserId,
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
                          // Fetch balances for this wallet
                          fetchXLMBalance(createData.publicKey)
                          fetchWalletUSDCBalance(createData.publicKey)

                          // Fetch DeFindex balance and auto-deposit status
                          fetchDefindexBalance(finalUserId)
                          fetchAutoDepositStatus(finalUserId)
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
                        "x-user-id": finalUserId,
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
                        // Fetch balances for this wallet
                        fetchXLMBalance(createData.publicKey)
                        fetchWalletUSDCBalance(createData.publicKey)
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
                    } else {
                      // After retries exhausted, stop loading and fetch balance anyway
                      console.log("[Wallet] Retries exhausted, stopping wallet fetch")
                      setIsBalanceLoading(false)
                      fetchDefindexBalance(finalUserId)
                    }
                  }
                } else {
                  // On retries, just try fetching the address again (might have been created)
                  if (retryCount < 3) {
                    console.log(`[Wallet] Retrying address fetch (attempt ${retryCount + 1}/3)...`)
                    setTimeout(() => fetchWalletAddress(retryCount + 1), 2000)
                    return
                  } else {
                    // After retries exhausted, stop loading and fetch balance
                    console.log("[Wallet] Retries exhausted, stopping wallet fetch")
                    setWalletAddress("") // Empty if wallet not created yet
                    setIsBalanceLoading(false) // Stop showing skeleton
                    fetchDefindexBalance(finalUserId) // Fetch balance anyway (might be 0)
                  }
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
                  console.error("[Wallet] Failed to fetch wallet address after retries - stopping loading")
                  setWalletAddress("") // Empty on error after retries
                  setIsBalanceLoading(false) // Stop showing skeleton
                  fetchDefindexBalance(finalUserId) // Fetch balance anyway (might be 0)
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



  // Get USDC balance (from DeFindex vault balance)
  const getBaseBalance = () => {
    // Use USDC balance from DeFindex vault (wallet + strategy balance)
    if (defindexBalance) {
      return defindexBalance.totalBalance // Total USDC balance (wallet + strategy)
    }
    // Fallback to vault balance if defindexBalance not loaded yet
    return Number(vault?.balance || 0)
  }

  const baseBalance = getBaseBalance()

  // Use refs to track values for smooth animation
  const animatedBalanceRef = useRef(0)
  const baseBalanceRef = useRef(0)
  
  // Simple balance animation - triggers on load and when balance changes
  useEffect(() => {
    // Check if base balance changed significantly (new funds received or currency changed)
    const baseChanged = Math.abs(baseBalance - baseBalanceRef.current) / (baseBalanceRef.current || 1) > 0.001

    // If we have a balance (even if it's 0) and we're still loading, mark as loaded
    if (defindexBalance !== null && isBalanceLoading) {
      setIsBalanceLoading(false)
      
      // On initial load, animate from 0 to the actual balance
      if (baseBalance > 0 && animatedBalanceRef.current === 0) {
        animatedBalanceRef.current = 0
        setAnimatedBalance(0)
        // Animate to the actual balance after a short delay
        setTimeout(() => {
          animatedBalanceRef.current = baseBalance
          baseBalanceRef.current = baseBalance
          setAnimatedBalance(baseBalance)
        }, 100)
        return
      }
    }

    if (baseChanged) {
      // Balance changed significantly - animate to new value
      const previousBalance = animatedBalanceRef.current
      animatedBalanceRef.current = baseBalance
      baseBalanceRef.current = baseBalance
      setAnimatedBalance(baseBalance)
    } else if (animatedBalanceRef.current === 0 && baseBalance > 0) {
      // Initial load with balance - animate from 0
      setTimeout(() => {
        animatedBalanceRef.current = baseBalance
        baseBalanceRef.current = baseBalance
        setAnimatedBalance(baseBalance)
      }, 100)
    } else if (animatedBalanceRef.current === 0) {
      // Just set it if it's 0
      animatedBalanceRef.current = baseBalance
      baseBalanceRef.current = baseBalance
      setAnimatedBalance(baseBalance)
    }
  }, [baseBalance, defindexBalance, isBalanceLoading])

  // Format balance - remove trailing zeros, only show decimals if needed
  const formatBalance = (value: number) => {
    if (value === 0) {
      return "0"
    }
    // Convert to string and remove trailing zeros
    const formatted = value.toString()
    // If it has a decimal point, remove trailing zeros and the decimal point if not needed
    if (formatted.includes('.')) {
      return formatted.replace(/\.?0+$/, '')
    }
    return formatted
  }
  
  const balance = formatBalance(animatedBalance)
  const maskedBalance = balance.replace(/\d/g, "*")
  
  // Get currency symbol for display
  const getCurrencySymbol = () => {
    return "USDC"
  }

  const toggleBalanceVisibility = () => {
    const newVisibility = !isBalanceVisible
    setIsBalanceVisible(newVisibility)
    
    // If toggling to visible, reset animated balance to 0 to trigger animation
    if (newVisibility && baseBalance > 0) {
      animatedBalanceRef.current = 0
      setAnimatedBalance(0)
      // Then animate to the actual balance
      setTimeout(() => {
        animatedBalanceRef.current = baseBalance
        setAnimatedBalance(baseBalance)
      }, 50)
    }
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
          alert(`✅ Auto-deposit successful: $${data.depositAmount} USDC deposited`)
          // Refresh balances
          const userId = sessionStorage.getItem("dev_username")
          if (userId) {
            fetchDefindexBalance(userId)
            fetchAutoDepositStatus(userId)
          }
        } else {
          alert("ℹ️ Auto-deposit not triggered")
        }
      } else {
        alert(`❌ Auto-deposit error: ${data.error}`)
      }
    } catch (error) {
      console.error("[Wallet] Error triggering auto-deposit:", error)
      alert("❌ Error processing auto-deposit")
    } finally {
      setIsAutoDepositing(false)
    }
  }




  const handleLogout = () => {
    // Clear all session storage
    sessionStorage.clear()
    // Note: We keep sozu_username in localStorage so user can log back in easily
    // Only clear it if user explicitly wants to remove their account
    
    // Close profile sheet
    setIsProfileSheetOpen(false)
    
    // Redirect to auth page
    window.location.href = "/auth"
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
    
    // Establish USDC trustline first (with client-side signing)
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

      console.log("[Wallet] Establishing USDC trustline with client-side signing...")
      
      // Step 1: Get unsigned transaction from server
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
        // Trustline already exists or was created successfully
        console.log("[Wallet] ✅ USDC trustline established successfully")
        if (result.transactionHash) {
          console.log("[Wallet] Transaction hash:", result.transactionHash)
          alert(`✅ USDC trustline established successfully\nHash: ${result.transactionHash.substring(0, 8)}...`)
        } else {
          console.log("[Wallet] Trustline already exists")
        }
      } else if (result.needsSigning && result.unsignedXdr) {
        // Step 2: Sign transaction client-side
        console.log("[Wallet] Signing transaction client-side...")
        const { retrieveKeypair, getKeypairByPublicKey } = await import("@/lib/storage/browser-keys")
        const { TransactionBuilder, Networks } = await import("@stellar/stellar-sdk")
        const { getCurrentCredentialId } = await import("@/lib/storage/key-utils")
        
        // Get keypair from browser storage
        const credentialId = await getCurrentCredentialId()
        let keypair = null
        
        if (credentialId) {
          keypair = await retrieveKeypair(credentialId, userId)
        }
        
        if (!keypair) {
          // Fallback: try to get by public key
          keypair = await getKeypairByPublicKey(walletAddress)
        }
        
        if (!keypair) {
          throw new Error("Keypair not found in browser storage. Please authenticate with a passkey first.")
        }
        
        // Verify public key matches
        if (keypair.publicKey() !== walletAddress) {
          throw new Error("Keypair public key doesn't match wallet address")
        }
        
        // Parse and sign transaction
        const networkPassphrase = walletNetwork === "mainnet" ? Networks.PUBLIC : Networks.TESTNET
        const transaction = TransactionBuilder.fromXDR(result.unsignedXdr, networkPassphrase)
        transaction.sign(keypair)
        
        const signedXdr = transaction.toXDR()
        
        // Step 3: Submit signed transaction
        console.log("[Wallet] Submitting signed transaction...")
        const submitResponse = await fetch("/api/wallet/stellar/trustline", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": userId,
          },
          body: JSON.stringify({
            signedTransactionXdr: signedXdr,
          }),
        })
        
        if (!submitResponse.ok) {
          const errorData = await submitResponse.json().catch(() => ({ error: "Unknown error" }))
          throw new Error(errorData.error || "Failed to submit signed transaction")
        }
        
        const submitResult = await submitResponse.json()
        
        if (submitResult.success) {
          console.log("[Wallet] ✅ USDC trustline created successfully")
          if (submitResult.transactionHash) {
            alert(`✅ USDC trustline established successfully\nHash: ${submitResult.transactionHash.substring(0, 8)}...`)
          }
        } else {
          throw new Error(submitResult.error || "Failed to create trustline")
        }
      } else {
        console.error("[Wallet] Trustline establishment failed:", result.error)
        throw new Error(result.error || "Failed to establish trustline")
      }
    } catch (error: any) {
      console.error("[Wallet] Error establishing trustline:", error)
      // Show error message to user
      alert(`❌ Error establishing USDC trustline: ${error.message || "Unknown error"}\n\nMake sure you have enough XLM to pay transaction fees.`)
      // Still open Stellar Expert even if trustline fails
    } finally {
      setIsEstablishingTrustline(false)
      // Open Stellar Expert after trustline is established (or if it fails)
      openStellarExpert()
    }
  }

  const handleResolveRecipient = async () => {
    if (!sendRecipient.trim()) {
      return
    }

    setIsResolvingRecipient(true)
    try {
      const userId = sessionStorage.getItem("dev_username")
      if (!userId) {
        throw new Error("User not authenticated")
      }

      // If in manual mode and recipient is already a Stellar address, use it directly
      if (isManualMode) {
        const isStellarAddress = /^G[A-Z0-9]{55}$/.test(sendRecipient.trim())
        if (isStellarAddress) {
          console.log("[Resolve Recipient] ✅ Manual mode: Using Stellar address directly:", {
            input: sendRecipient.trim(),
            addressPreview: sendRecipient.trim().substring(0, 10) + "..." + sendRecipient.trim().substring(sendRecipient.trim().length - 10),
            fullAddress: sendRecipient.trim(),
            memo: sendMemo.trim() || "none"
          })
          setResolvedRecipientAddress(sendRecipient.trim())
          setSendStep("amount")
          return
        } else {
          throw new Error("Invalid Stellar wallet address format")
        }
      }

      // Resolve recipient (Sozu tag or wallet address)
      const resolveResponse = await fetch("/api/wallet/resolve-recipient", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({ recipient: sendRecipient.trim() }),
      })

      if (!resolveResponse.ok) {
        const error = await resolveResponse.json()
        console.error("[Resolve Recipient] Error response:", error)
        if (error.details && error.details.walletsChecked) {
          console.error("[Resolve Recipient] Total wallets in database:", error.details.totalWalletsInDatabase)
          console.error("[Resolve Recipient] Wallets checked (full details):", JSON.stringify(error.details.walletsChecked, null, 2))
          error.details.walletsChecked.forEach((w: any, i: number) => {
            console.error(`[Resolve Recipient] Wallet ${i + 1}:`, {
              publicKey: w.publicKey,
              network: w.network,
              updatedAt: w.updatedAt,
              createdAt: w.createdAt
            })
          })
        }
        throw new Error(error.error || "Failed to resolve recipient")
      }

      const { walletAddress: recipientAddress } = await resolveResponse.json()
      if (!recipientAddress) {
        throw new Error("Recipient wallet address not found")
      }

      // Log the resolved address for debugging
      console.log("[Resolve Recipient] ✅ Recipient resolved:", {
        input: sendRecipient.trim(),
        resolvedAddress: recipientAddress,
        addressPreview: recipientAddress.substring(0, 10) + "..." + recipientAddress.substring(recipientAddress.length - 10),
        fullAddress: recipientAddress // Log full address for debugging
      })

      // Store resolved address and move to amount step
      setResolvedRecipientAddress(recipientAddress)
      setSendStep("amount")
    } catch (error: any) {
      console.error("[Resolve Recipient] Error:", error)
      alert(`❌ ${error.message || "Invalid recipient"}`)
    } finally {
      setIsResolvingRecipient(false)
    }
  }

  const handleSendPayment = async () => {
    if (!sendAmount || parseFloat(sendAmount) <= 0 || !resolvedRecipientAddress) {
      return
    }

    const amount = parseFloat(sendAmount)
    if (!walletAddress) {
      alert("Wallet address not found. Please create a wallet first.")
      return
    }

    // Check balance before proceeding - fetch REAL-TIME balance from Stellar network
    // Don't rely on cached balance - verify actual wallet balance
    const userId = sessionStorage.getItem("dev_username")
    if (!userId) {
      alert("User not authenticated. Please log in again.")
      return
    }
    
    console.log("[Send Payment] Fetching real-time USDC balance for verification...")
    let currentBalance = defindexBalance?.walletBalance || 0
    
    // Fetch real-time balance from Stellar network to ensure accuracy
    let balanceDataFromResponse: any = null
    if (walletAddress) {
      try {
        const balanceResponse = await fetch(`/api/wallet/stellar/balance?publicKey=${walletAddress}`, {
          headers: {
            "x-user-id": userId,
          },
        })
        
        if (balanceResponse.ok) {
          balanceDataFromResponse = await balanceResponse.json()
          if (balanceDataFromResponse.usdcBalance !== undefined) {
            currentBalance = balanceDataFromResponse.usdcBalance
            console.log("[Send Payment] ✅ Real-time USDC balance:", {
              walletBalance: balanceDataFromResponse.usdcBalance,
              defindexBalance: balanceDataFromResponse.defindexBalance || 0,
              totalUsdcBalance: balanceDataFromResponse.totalUsdcBalance || balanceDataFromResponse.usdcBalance,
              allBalances: balanceDataFromResponse.allBalances || [],
              note: "walletBalance is available for sending, defindexBalance is locked"
            })
          }
        }
      } catch (balanceError) {
        console.warn("[Send Payment] Could not fetch real-time balance, using cached:", balanceError)
        // Fall back to cached balance
      }
    }
    
    const bufferAmount = 0.01 // Keep 0.01 USDC buffer for fees and safety
    const requiredBalance = amount + bufferAmount

    // Log balance breakdown (wallet vs DeFindex strategy)
    const walletBalance = defindexBalance?.walletBalance || 0
    const strategyBalance = defindexBalance?.strategyBalance || 0
    const totalBalance = defindexBalance?.totalBalance || 0
    
    // Get DeFindex locked balance from the API response or cached state
    const defindexLocked = balanceDataFromResponse?.defindexBalance || strategyBalance || 0
    
    console.log("[Send Payment] 💰 Balance breakdown:", {
      walletBalance: walletBalance.toFixed(2) + " USDC (available for sending)",
      strategyBalance: strategyBalance.toFixed(2) + " USDC (in DeFindex strategy)",
      totalBalance: totalBalance.toFixed(2) + " USDC (total)",
      currentBalance: currentBalance.toFixed(2) + " USDC (real-time wallet balance)",
      defindexLocked: defindexLocked.toFixed(2) + " USDC (locked in DeFindex)",
      sendAmount: amount.toFixed(2) + " USDC",
      bufferAmount: bufferAmount.toFixed(2) + " USDC",
      requiredBalance: requiredBalance.toFixed(2) + " USDC",
      walletAddress: walletAddress ? walletAddress.substring(0, 10) + "..." : "N/A",
      note: "Only wallet balance can be used for sending. Strategy balance is locked in DeFindex."
    })
    
    if (currentBalance < requiredBalance) {
      const shortfall = requiredBalance - currentBalance
      
      let errorMessage = `Insufficient balance. You need ${requiredBalance.toFixed(2)} USDC (including ${bufferAmount.toFixed(2)} USDC buffer) but only have ${currentBalance.toFixed(2)} USDC available in your wallet.`
      
      if (defindexLocked > 0) {
        errorMessage += `\n\nYou have ${defindexLocked.toFixed(2)} USDC locked in DeFindex strategy. You need to withdraw from DeFindex first to make it available for sending.`
      }
      
      console.error("[Send Payment] ❌ Insufficient balance:", {
        required: requiredBalance,
        available: currentBalance,
        shortfall: shortfall,
        defindexLocked: defindexLocked,
        totalUsdc: (currentBalance + defindexLocked).toFixed(2),
        message: "Funds in DeFindex are locked and cannot be used for sending"
      })
      
      alert(errorMessage)
      setIsSending(false)
      return
    }

    setIsSending(true)
    try {
      // userId already retrieved above

      // Step 1: Get unsigned transaction from server
      // Pass the sender's wallet address to ensure we use the correct one
      console.log("[Send Payment] Building transaction:", {
        sender: walletAddress ? walletAddress.substring(0, 10) + "..." + walletAddress.substring(walletAddress.length - 10) : "N/A",
        destination: resolvedRecipientAddress ? resolvedRecipientAddress.substring(0, 10) + "..." + resolvedRecipientAddress.substring(resolvedRecipientAddress.length - 10) : "N/A",
        fullDestination: resolvedRecipientAddress, // Log full address for debugging
        amount: amount.toString(),
        currentBalance: currentBalance.toFixed(2),
        requiredBalance: requiredBalance.toFixed(2)
      })
      
      const buildResponse = await fetch("/api/wallet/stellar/payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({
          destination: resolvedRecipientAddress,
          amount: amount.toString(),
          sender: walletAddress, // Pass the wallet address from frontend state
          memo: sendMemo.trim() || undefined, // Pass memo if provided
        }),
      })

      if (!buildResponse.ok) {
        const error = await buildResponse.json()
        throw new Error(error.error || "Failed to build payment transaction")
      }

      const { unsignedXdr } = await buildResponse.json()
      if (!unsignedXdr) {
        throw new Error("No unsigned transaction returned")
      }

      // Step 2: Sign transaction with biometric (no text, just Face ID prompt)
      const stellarSdk = await import("@stellar/stellar-sdk")
      const { getStellarConfig } = await import("@/lib/turnkey/config")
      const stellarConfig = getStellarConfig()
      const networkPassphrase = stellarConfig.network === "mainnet" ? stellarSdk.Networks.PUBLIC : stellarSdk.Networks.TESTNET
      const transactionXdr = stellarSdk.TransactionBuilder.fromXDR(unsignedXdr, networkPassphrase)
      if (transactionXdr instanceof stellarSdk.FeeBumpTransaction) {
        throw new Error("Fee bump transactions are not supported")
      }
      // TypeScript knows this is a Transaction after the instanceof check
      const transaction = transactionXdr

      // Verify transaction source matches our wallet address
      console.log("[Send Payment] Verifying transaction source:", {
        transactionSource: transaction.source,
        walletAddress: walletAddress,
        match: transaction.source === walletAddress
      })

      if (transaction.source !== walletAddress) {
        console.error("[Send Payment] ❌ Transaction source doesn't match wallet address!", {
          transactionSource: transaction.source,
          walletAddress: walletAddress
        })
        throw new Error(`Transaction source mismatch. Expected: ${walletAddress?.substring(0, 10)}..., Got: ${transaction.source.substring(0, 10)}...`)
      }

      // Log transaction details before signing
      const operations = transaction.operations || []
      if (operations.length > 0) {
        const paymentOp = operations[0] as any
        console.log("[Send Payment] Transaction details before signing:", {
          source: transaction.source.substring(0, 10) + "..." + transaction.source.substring(transaction.source.length - 10),
          destination: paymentOp.destination ? paymentOp.destination.substring(0, 10) + "..." + paymentOp.destination.substring(paymentOp.destination.length - 10) : "N/A",
          fullDestination: paymentOp.destination, // Log full destination for debugging
          amount: paymentOp.amount,
          asset: paymentOp.asset?.code || "native"
        })
      }

      // Get credential ID and sign (this will trigger biometric prompt)
      const { getCurrentCredentialId } = await import("@/lib/storage/key-utils")
      const { signTransactionClientSide } = await import("@/lib/stellar/client-signing")
      
      const credentialId = await getCurrentCredentialId()
      if (!credentialId) {
        throw new Error("Credential ID not found. Please log in again.")
      }

      // Sign transaction (triggers biometric prompt)
      // Use transaction.source as the publicKey to ensure we sign with the correct key
      console.log("[Send Payment] Signing transaction with wallet address:", walletAddress)
      const signedResult = await signTransactionClientSide(transaction, credentialId, walletAddress, userId)
      const signedXdr = signedResult.transaction.toXDR()

      // Step 3: Submit signed transaction
      const submitResponse = await fetch("/api/wallet/stellar/payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({
          signedTransactionXdr: signedXdr,
        }),
      })

      if (!submitResponse.ok) {
        const error = await submitResponse.json()
        const errorMessage = error.error || "Failed to submit payment"
        console.error("[Send Payment] Error response:", error)
        throw new Error(errorMessage)
      }

      const result = await submitResponse.json()
      if (result.success && result.transactionHash) {
        // Show success modal
        setTransactionHash(result.transactionHash)
        setShowSuccessModal(true)
        setIsSendModalOpen(false)
        
        // Refresh balance
        if (walletAddress) {
          fetchWalletUSDCBalance(walletAddress)
        }
      } else {
        const errorMessage = result.error || "Payment failed"
        console.error("[Send Payment] Payment failed:", result)
        throw new Error(errorMessage)
      }
    } catch (error: any) {
      console.error("[Send Payment] Error:", error)
      console.error("[Send Payment] Error details:", {
        message: error.message,
        stack: error.stack,
        response: error.response,
        status: error.status
      })
      
      // Provide more detailed error messages
      let errorMessage = error.message || "Unknown error"
      if (error.message?.includes("account not found")) {
        errorMessage = "Your wallet account is not active on the Stellar network. Please ensure your account has been funded with at least 1 XLM."
      } else if (error.message?.includes("insufficient")) {
        errorMessage = "Insufficient balance. Please check your USDC balance."
      } else if (error.message?.includes("trustline")) {
        errorMessage = "USDC trustline not established. Please set up your wallet first."
      } else if (error.message?.includes("Credential ID not found")) {
        errorMessage = "Authentication error. Please log out and log back in."
      }
      
      alert(`❌ ${errorMessage}`)
    } finally {
      setIsSending(false)
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

  const handleExposeSecretKey = async () => {
    try {
      const { retrieveKeypair } = await import("@/lib/storage/browser-keys")
      const { getCredentialIdFromSession } = await import("@/lib/storage/key-utils")
      const { Keypair } = await import("@stellar/stellar-sdk")
      
      const credentialId = getCredentialIdFromSession()
      const userId = sessionStorage.getItem("dev_username")
      
      if (!credentialId) {
        alert("No credential ID found. Please log in again.")
        return
      }
      
      const keypair = await retrieveKeypair(credentialId, userId || undefined)
      
      if (!keypair) {
        alert("No keypair found. Please create a wallet first.")
        return
      }
      
      // Verify the keypair matches the wallet address
      const publicKeyFromKeypair = keypair.publicKey()
      if (walletAddress && publicKeyFromKeypair !== walletAddress) {
        console.error("[Wallet] ⚠️ Keypair mismatch!", {
          walletAddress,
          publicKeyFromKeypair,
        })
        alert(`⚠️ WARNING: Secret key doesn't match wallet address!\n\nWallet Address: ${walletAddress}\nKeypair Public Key: ${publicKeyFromKeypair}\n\nThis secret key cannot be used to sign transactions for this wallet.`)
        return
      }
      
      const secret = keypair.secret()
      
      // Double-check: verify secret key can recreate the public key
      try {
        const verifyKeypair = Keypair.fromSecret(secret)
        if (verifyKeypair.publicKey() !== publicKeyFromKeypair) {
          console.error("[Wallet] ⚠️ Secret key verification failed!")
          alert("⚠️ Secret key verification failed. The secret key cannot recreate the public key.")
          return
        }
        console.log("[Wallet] ✅ Secret key verified - matches wallet address:", walletAddress)
      } catch (verifyError) {
        console.error("[Wallet] ⚠️ Error verifying secret key:", verifyError)
        alert("⚠️ Failed to verify secret key. It may be invalid.")
        return
      }
      
      setSecretKey(secret)
      setIsSecretKeyExposed(true)
      console.log("[Wallet] Secret key exposed and verified (first 10 chars):", secret.substring(0, 10) + "...")
    } catch (error) {
      console.error("[Wallet] Error exposing secret key:", error)
      alert("Failed to retrieve secret key. Please try again.")
    }
  }

  const handleCopySecretKey = async () => {
    if (!secretKey) {
      return
    }
    try {
      await navigator.clipboard.writeText(secretKey)
      setSecretKeyCopied(true)
      setTimeout(() => setSecretKeyCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy secret key:", err)
      alert("Failed to copy secret key")
    }
  }

  const handleCheckAccountDiagnostics = async () => {
    if (!walletAddress) {
      alert("No wallet address available")
      return
    }

    setLoadingDiagnostics(true)
    try {
      const { checkAccountStatus } = await import("@/lib/stellar/wallet-creator")
      const { USDC_ISSUERS } = await import("@/lib/stellar/wallet-creator")
      const { getStellarConfig } = await import("@/lib/turnkey/config")
      
      const status = await checkAccountStatus(walletAddress)
      const stellarConfig = getStellarConfig()
      const usdcIssuer = USDC_ISSUERS[stellarConfig.network]
      
      // Get XLM balance
      const xlmBalance = status.balances.find(b => b.asset === "XLM")
      const balanceValue = xlmBalance ? parseFloat(xlmBalance.balance) : 0
      
      setAccountDiagnostics({
        xlmBalance: balanceValue,
        hasTrustline: status.hasUSDCTrustline,
        network: status.network,
        usdcIssuer: usdcIssuer,
      })
      
      // Show detailed info in console
      console.log("[Wallet Diagnostics]", {
        network: status.network,
        xlmBalance: balanceValue,
        hasTrustline: status.hasUSDCTrustline,
        usdcIssuer,
        allBalances: status.balances,
        accountExists: status.exists,
      })
      
      // Show alert with key info
      if (!status.exists) {
        alert("⚠️ Account not found on Stellar network. Please fund it first.")
      } else if (balanceValue < 1.5) {
        alert(`⚠️ Low balance: ${balanceValue.toFixed(7)} XLM\nYou need at least 1.5 XLM to create a trustline.\n\nMinimum requirements:\n- 1 XLM for account\n- 0.5 XLM for trustline reserve`)
      } else if (status.hasUSDCTrustline) {
        alert("✅ USDC trustline already exists!")
      } else {
        alert(`Account Status:\n\nNetwork: ${status.network.toUpperCase()}\nBalance: ${balanceValue.toFixed(7)} XLM\nTrustline: Not found\n\nUSDC Issuer:\n${usdcIssuer}\n\n✅ Use this issuer address in Stellar Lab to create the trustline.`)
      }
    } catch (error: any) {
      console.error("[Wallet] Error checking account diagnostics:", error)
      const errorMsg = error?.response?.data?.detail || error?.message || "Unknown error"
      alert(`Failed to check account status:\n\n${errorMsg}\n\nMake sure:\n1. Your account is funded\n2. You're connected to the correct network`)
    } finally {
      setLoadingDiagnostics(false)
    }
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
      {isBalanceLoading ? (
        <WalletSkeleton />
      ) : (
        <motion.div 
          className="relative z-10 h-full overflow-y-auto touch-pan-y pb-24 md:pb-28"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{ touchAction: 'pan-y' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <div className="container mx-auto px-6 py-8 md:py-12">
            {/* Balance Display Box */}
            <div className="mb-8 relative">
              <div className="border border-white/20 rounded-lg p-8 text-center relative">
                <div
                  className="text-6xl font-bold text-white cursor-pointer select-none flex flex-col items-center justify-center min-h-[4rem]"
                  onClick={toggleBalanceVisibility}
                >
                  {isBalanceVisible ? (
                    <SlidingNumber value={animatedBalance} />
                  ) : (
                    <span className="tabular-nums">{maskedBalance}</span>
                  )}
                  <div className="text-2xl font-bold text-white mt-2">USDC</div>
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

            {/* Create New Wallet Button - Show for first-time users without wallet */}
            {!walletAddress && (
              <div className="mb-8">
                <Button
                  onClick={() => setIsProfileSheetOpen(true)}
                  className="w-full h-14 text-lg font-semibold bg-white text-black hover:bg-white/90 transition-all duration-200 rounded-lg shadow-lg hover:shadow-xl"
                >
                  <Wallet className="w-5 h-5 mr-2" />
                  Create new wallet
                </Button>
              </div>
            )}
          </div>

          {/* Bottom Menu Bar - Three equally spaced buttons (floating) */}
          <div className="fixed bottom-0 left-0 right-0 z-10 px-4 py-3 md:px-6 md:py-4">
            <div className="max-w-md mx-auto flex items-center justify-between">
              {/* Left: QR Code Button */}
              <button
                onClick={() => setIsQRCodeOpen(true)}
                className="flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 transition-colors backdrop-blur-sm"
                aria-label="Show QR Code"
              >
                <QrCode className="w-6 h-6 md:w-7 md:h-7 text-white" />
              </button>

              {/* Center: Circular Button with Upwards Arrow - Send Payment */}
              <button
                onClick={() => setIsSendModalOpen(true)}
                className="flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-full bg-white text-black hover:bg-white/90 transition-colors shadow-lg"
                aria-label="Send Payment"
              >
                <ArrowUp className="w-7 h-7 md:w-8 md:h-8" />
              </button>

              {/* Right: Wallet Button */}
              <button
                onClick={() => setIsProfileSheetOpen(true)}
                className="flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 transition-colors relative backdrop-blur-sm"
                aria-label={t.openProfile}
              >
                <Wallet className="w-6 h-6 md:w-7 md:h-7 text-white" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs text-white font-bold">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      )}

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
                  Loading referral code...
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
                          <span>Copied!</span>
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
                  Failed to load referral code
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
          {/* Accessibility: Title and Description for screen readers */}
          <SheetTitle className="sr-only">Profile Settings</SheetTitle>
          <SheetDescription className="sr-only">
            Manage your profile, wallet address, and account settings
          </SheetDescription>

          {/* Back Button - Top Left */}
          <button
            onClick={() => setIsProfileSheetOpen(false)}
            className="absolute top-4 left-4 z-10 p-2 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 transition-colors"
            aria-label={t.closeProfile}
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>


          {/* Sozu Tag Title - Centered at top */}
          <div className="px-4 pt-8 pb-4 text-center">
            <h2 className="text-2xl font-bold text-white">
              ${username || "Loading..."}
            </h2>
          </div>

          <div className="space-y-6 px-4 pb-8">
            <Card className="border-white/20 bg-black">
              <CardContent className="space-y-6 pt-6">

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
                          <span className="text-xs">Setting up...</span>
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

                {/* Secret Key - Only show if wallet exists */}
                {walletAddress && (
                  <div className="space-y-2 pt-4 border-t border-white/20">
                    <Label className="text-white/80 text-sm flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      Secret Key
                    </Label>
                    <div className="p-4 bg-white/5 border border-white/10 rounded-lg overflow-hidden">
                      {isSecretKeyExposed && secretKey ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <code className="text-xs text-white/90 font-mono truncate flex-1 pr-2">
                              {secretKey.length > 40 
                                ? `${secretKey.substring(0, 20)}...${secretKey.substring(secretKey.length - 20)}`
                                : secretKey}
                            </code>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={handleCopySecretKey}
                              className="bg-transparent border-white/20 text-white hover:bg-white/10 flex-shrink-0"
                            >
                              {secretKeyCopied ? (
                                <Check className="w-4 h-4 text-green-400" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                          <p className="text-xs text-yellow-400/80">
                            ⚠️ Keep this secret key secure. Anyone with access to it can control your wallet.
                          </p>
                          <div className="text-xs text-green-400/80 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Verified: Secret key matches wallet address
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-white/40 font-mono truncate flex-1 pr-2">
                            ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
                          </code>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={handleExposeSecretKey}
                            className="bg-transparent border-white/20 text-white hover:bg-white/10 flex-shrink-0"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-white/60">
                      Use this secret key to manually fund your account and add the USDC trustline using Stellar tools.
                    </p>
                    
                    {/* Account Diagnostics */}
                    <div className="pt-4 border-t border-white/20">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCheckAccountDiagnostics}
                        disabled={loadingDiagnostics}
                        className="w-full bg-transparent border-white/20 text-white hover:bg-white/10"
                      >
                        {loadingDiagnostics ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin mr-2" />
                            Checking...
                          </>
                        ) : (
                          "Check Account Status"
                        )}
                      </Button>
                      
                      {accountDiagnostics && (
                        <div className="mt-3 p-3 bg-white/5 border border-white/10 rounded-lg space-y-2">
                          <div className="text-xs text-white/80">
                            <strong>Network:</strong> {accountDiagnostics.network?.toUpperCase() || "Unknown"}
                          </div>
                          <div className="text-xs text-white/80">
                            <strong>XLM Balance:</strong> {accountDiagnostics.xlmBalance !== null ? `${accountDiagnostics.xlmBalance.toFixed(7)} XLM` : "Unknown"}
                          </div>
                          {accountDiagnostics.xlmBalance !== null && accountDiagnostics.xlmBalance < 1.5 && (
                            <div className="text-xs text-yellow-400">
                              ⚠️ Low balance! You need at least 1.5 XLM to create a trustline.
                            </div>
                          )}
                          <div className="text-xs text-white/80">
                            <strong>USDC Trustline:</strong> {accountDiagnostics.hasTrustline ? "✅ Exists" : "❌ Not found"}
                          </div>
                          <div className="text-xs text-white/60 break-all">
                            <strong>USDC Issuer:</strong> {accountDiagnostics.usdcIssuer || "Unknown"}
                          </div>
                          {!accountDiagnostics.hasTrustline && (
                            <div className="text-xs text-white/60 mt-2 pt-2 border-t border-white/10">
                              <strong>For Stellar Lab:</strong>
                              <ul className="list-disc list-inside mt-1 space-y-1">
                                <li>Select <strong>{accountDiagnostics.network?.toUpperCase() || "TESTNET"}</strong> network</li>
                                <li>Use issuer: <code className="text-xs">{accountDiagnostics.usdcIssuer?.substring(0, 20)}...</code></li>
                                <li>Ensure balance ≥ 1.5 XLM</li>
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Cypherpunk Wallet Creator - Phase 3 */}
                {(!walletAddress || walletAddress === "") && (
                  <div className="space-y-2 pt-4 border-t border-white/20">
                    <p className="text-xs text-white/60 mb-2">
                      Create your non-custodial wallet with real Stellar account and USDC trustline
                    </p>
                    <div className="bg-black/50 rounded-lg p-4 border border-white/10">
                      <WalletCreator 
                        compact={true}
                        onWalletCreated={async (publicKey, network) => {
                          console.log("[Wallet] ✅ Wallet created via WalletCreator:", publicKey, network)
                          setWalletAddress(publicKey)
                          setWalletNetwork(network)
                          
                          // Fetch XLM balance for the new wallet
                          try {
                            const userId = sessionStorage.getItem("dev_username")
                            if (userId) {
                              const balanceResponse = await fetch("/api/wallet/stellar/balance", {
                                headers: {
                                  "x-user-id": userId,
                                },
                              })
                              if (balanceResponse.ok) {
                                const balanceData = await balanceResponse.json()
                                if (balanceData.balance !== undefined) {
                                  setXlmBalance(balanceData.balance)
                                }
                              }
                            }
                          } catch (error) {
                            console.error("[Wallet] Error fetching balance after wallet creation:", error)
                          }
                        }}
                      />
                    </div>
                  </div>
                )}

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
              Balance Audit
            </DialogTitle>
            <DialogDescription className="text-white/60">
              Detailed breakdown of your balance
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {defindexBalance ? (
              <>
                <div className="space-y-3">
                  {/* Wallet Balance */}
                  <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/10">
                    <span className="text-white/80">
                      Wallet:
                    </span>
                    <span className="text-white font-medium text-lg">
                      ${defindexBalance.walletBalance === 0 ? "0" : defindexBalance.walletBalance.toFixed(2)} USDC
                    </span>
                  </div>

                  {/* Strategy Balance */}
                  <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/10">
                    <span className="text-white/80">
                      DeFi Strategy:
                    </span>
                    <span className="text-green-400 font-medium text-lg">
                      ${defindexBalance.strategyBalance === 0 ? "0" : defindexBalance.strategyBalance.toFixed(2)} USDC
                    </span>
                  </div>

                  {/* Total Balance */}
                  <div className="flex justify-between items-center p-4 bg-white/10 rounded-lg border-2 border-white/20">
                    <span className="text-white font-semibold">
                      Total:
                    </span>
                    <span className="text-white font-bold text-xl">
                      ${defindexBalance.totalBalance === 0 ? "0" : defindexBalance.totalBalance.toFixed(2)} USDC
                    </span>
                  </div>

                  {/* Shares */}
                  {defindexBalance.strategyShares > 0 && (
                    <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/10">
                      <span className="text-white/60 text-sm">
                        Shares:
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
                      <span>View Blend Strategy</span>
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
                No balance data available
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={isQRCodeOpen} onOpenChange={setIsQRCodeOpen}>
        <DialogContent className="bg-black/80 backdrop-blur-md border-white/20 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white text-2xl">Receive USDC</DialogTitle>
            <DialogDescription className="text-white/60">
              Scan this QR code to send USDC to your wallet on the Stellar network
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {walletAddress ? (
              <>
                {/* QR Code */}
                <div className="flex justify-center p-6 bg-white rounded-lg">
                  <QRCodeComponent walletAddress={walletAddress} walletNetwork={walletNetwork} />
                </div>

                {/* Wallet Address with Memo */}
                <div className="space-y-2">
                  <Label className="text-white/80 text-sm">Wallet Address</Label>
                  <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
                    <code className="text-sm text-white font-mono break-all">
                      {walletAddress}
                    </code>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white/80 text-sm">Memo (Required)</Label>
                  <div className="p-3 bg-white/5 border border-white/10 rounded-lg flex items-center justify-between">
                    <code className="text-sm text-white font-mono">
                      {sessionStorage.getItem("dev_username") || "No memo"}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={async () => {
                        const memo = sessionStorage.getItem("dev_username") || ""
                        if (memo) {
                          await navigator.clipboard.writeText(memo)
                          alert("Memo copied to clipboard")
                        }
                      }}
                      className="bg-transparent border-white/20 text-white hover:bg-white/10"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-white/60">
                    Include this memo when sending USDC to ensure proper credit to your account
                  </p>
                </div>

                {/* Copy Address Button */}
                <Button
                  onClick={handleCopyWalletAddress}
                  className="w-full bg-white text-black hover:bg-white/90 font-semibold"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Wallet Address
                </Button>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-white/60">Wallet address not available</p>
                <p className="text-sm text-white/40 mt-2">
                  Create a wallet first to generate a QR code
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Payment Dialog */}
      <Dialog open={isSendModalOpen} onOpenChange={(open) => {
        setIsSendModalOpen(open)
        if (!open) {
          // Reset state when closing
          setSendStep("recipient")
          setSendRecipient("")
          setSendAmount("")
          setResolvedRecipientAddress(null)
          setIsManualMode(false)
          setSendMemo("")
        }
      }}>
        <DialogContent className="bg-black/80 backdrop-blur-md border-white/20 text-white max-w-md">
          <DialogHeader className="sr-only">
            <DialogTitle>Send Payment</DialogTitle>
            <DialogDescription>Send USDC to a recipient</DialogDescription>
          </DialogHeader>
          {sendStep === "recipient" ? (
            <div className="space-y-4 py-4">
              {!isManualMode ? (
                <>
                  {/* Sozu Tag Input */}
                  <Input
                    type="text"
                    value={sendRecipient}
                    onChange={(e) => setSendRecipient(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && sendRecipient.trim()) {
                        handleResolveRecipient()
                      }
                    }}
                    placeholder="$Sozutag"
                    className="bg-white/5 border-white/20 text-white placeholder:text-white/40 text-lg h-14"
                    autoFocus
                  />

                  {/* Manual Mode Button */}
                  <button
                    onClick={() => setIsManualMode(true)}
                    className="w-full text-white text-sm hover:text-white/80 transition-colors"
                    type="button"
                  >
                    Manual wallet address + memo
                  </button>

                  {/* Continue Button */}
                  <Button
                    onClick={handleResolveRecipient}
                    disabled={!sendRecipient.trim() || isResolvingRecipient}
                    className="w-full bg-white text-black hover:bg-white/90 font-semibold disabled:opacity-50 disabled:cursor-not-allowed h-14 text-lg"
                  >
                    {isResolvingRecipient ? (
                      <>
                        <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin mr-2" />
                        Resolving...
                      </>
                    ) : (
                      "Continue"
                    )}
                  </Button>
                </>
              ) : (
                <>
                  {/* Stellar Wallet Address Input */}
                  <Input
                    type="text"
                    value={sendRecipient}
                    onChange={(e) => setSendRecipient(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && sendRecipient.trim()) {
                        handleResolveRecipient()
                      }
                    }}
                    placeholder="Stellar Wallet Address"
                    className="bg-white/5 border-white/20 text-white placeholder:text-white/40 text-lg h-14"
                    autoFocus
                  />

                  {/* Memo Input */}
                  <Input
                    type="text"
                    value={sendMemo}
                    onChange={(e) => setSendMemo(e.target.value)}
                    placeholder="Memo (optional)"
                    className="bg-white/5 border-white/20 text-white placeholder:text-white/40 text-lg h-14"
                  />

                  {/* Back to Sozu Tag Button */}
                  <button
                    onClick={() => {
                      setIsManualMode(false)
                      setSendRecipient("")
                      setSendMemo("")
                    }}
                    className="w-full text-white text-sm hover:text-white/80 transition-colors"
                    type="button"
                  >
                    Use Sozu tag instead
                  </button>

                  {/* Continue Button */}
                  <Button
                    onClick={handleResolveRecipient}
                    disabled={!sendRecipient.trim() || isResolvingRecipient}
                    className="w-full bg-white text-black hover:bg-white/90 font-semibold disabled:opacity-50 disabled:cursor-not-allowed h-14 text-lg"
                  >
                    {isResolvingRecipient ? (
                      <>
                        <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin mr-2" />
                        Resolving...
                      </>
                    ) : (
                      "Continue"
                    )}
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {/* Amount Display */}
              <div className="text-center py-2">
                <div className="text-4xl font-bold text-white">
                  {sendAmount || "0.00"}
                </div>
                <div className="text-white/60 text-sm mt-1">USDC</div>
              </div>

              {/* Amount Input (hidden but functional for mobile keyboard) */}
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
                placeholder="0.00"
                className="bg-white/5 border-white/20 text-white placeholder:text-white/40 text-2xl text-center h-16 font-semibold"
                autoFocus
              />

              {/* Send Button */}
              <Button
                onClick={handleSendPayment}
                disabled={!sendAmount || isSending || parseFloat(sendAmount) <= 0}
                className="w-full bg-white text-black hover:bg-white/90 font-semibold disabled:opacity-50 disabled:cursor-not-allowed h-14 text-lg"
              >
                {isSending ? (
                  <>
                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-2" />
                    Send
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={(open) => {
        setShowSuccessModal(open)
        if (!open) {
          // Reset all send state when closing success modal
          setSendStep("recipient")
          setSendRecipient("")
          setSendAmount("")
          setResolvedRecipientAddress(null)
          setTransactionHash(null)
          setIsManualMode(false)
          setSendMemo("")
        }
      }}>
        <DialogContent className="bg-black/80 backdrop-blur-md border-white/20 text-white max-w-md">
          <DialogHeader className="sr-only">
            <DialogTitle>Transaction Successful</DialogTitle>
            <DialogDescription>Your payment was sent successfully</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 text-center">
            <div className="w-16 h-16 mx-auto bg-green-500/20 rounded-full flex items-center justify-center">
              <Check className="w-8 h-8 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-white">Transaction Successful</div>
            {transactionHash && (
              <div className="text-sm text-white/60 font-mono">
                {transactionHash.substring(0, 8)}...{transactionHash.substring(transactionHash.length - 8)}
              </div>
            )}
            <Button
              onClick={() => {
                setShowSuccessModal(false)
                setSendStep("recipient")
                setSendRecipient("")
                setSendAmount("")
                setResolvedRecipientAddress(null)
                setTransactionHash(null)
                setIsManualMode(false)
                setSendMemo("")
              }}
              className="w-full bg-white text-black hover:bg-white/90 font-semibold h-14 text-lg"
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}

