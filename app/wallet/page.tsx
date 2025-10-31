"use client"

import { useEffect, useState } from "react"
import { Wallet, Award, ArrowLeft, Globe, Camera } from "lucide-react"
import { FallingPattern } from "@/components/ui/falling-pattern"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

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
  const [isBalanceVisible, setIsBalanceVisible] = useState(false)
  const [isTrustModalOpen, setIsTrustModalOpen] = useState(false)
  const [isProfileSheetOpen, setIsProfileSheetOpen] = useState(false)
  const [modalView, setModalView] = useState<"main" | "invite" | "vouch">("main")
  const [vouchUsername, setVouchUsername] = useState("")
  const [vouchPoints, setVouchPoints] = useState("1")
  const [vouchLoading, setVouchLoading] = useState(false)
  const [inviteCode, setInviteCode] = useState("")
  const [currentAPY, setCurrentAPY] = useState(18.0)
  
  // Profile state
  const [username, setUsername] = useState("")
  const [walletAddress, setWalletAddress] = useState("")
  const [language, setLanguage] = useState<"es" | "en">("es")
  const [profilePic, setProfilePic] = useState<string | null>(null)
  const [walletCopied, setWalletCopied] = useState(false)
  
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
      language: "Idioma",
      save: "Guardar",
      cancel: "Cancelar",
      english: "Inglés",
      spanish: "Español",
      changePicture: "Cambiar Foto",
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
      language: "Language",
      save: "Save",
      cancel: "Cancel",
      english: "English",
      spanish: "Spanish",
      changePicture: "Change Picture",
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
      // Social share
      inviteMessage: "Join Sozu Credit! Use my invite code: {code} and let's both get extra trust points. 🚀",
      codeCopiedShare: "Code copied to clipboard. Ready to share!",
    },
  }
  
  const t = texts[language]

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
          
          // Load profile data
          // TODO: Replace mock wallet generation with Turnkey wallet generation
          // Integration plan:
          // 1. Create API endpoint /api/wallet/generate using Turnkey SDK
          // 2. Use Turnkey's CreatePrivateKeys function to generate wallet per user
          // 3. Store wallet address in database (add wallet_address column to profiles or vaults table)
          // 4. Fetch real wallet address from database instead of generating mock
          // 5. Ensure wallet is generated during user registration in /api/auth/register/verify
          // 
          // Example Turnkey integration:
          // - Use @turnkey/http and @turnkey/api-key-stamper packages
          // - Create wallet using CreatePrivateKeys activity with curve SECP256K1
          // - Extract Ethereum address from public key
          // - Store wallet_id and address in database for user
          const mockWalletAddress = "0x" + userId.replace(/-/g, "").substring(0, 40).padEnd(40, "0")
          setUsername(userId.substring(0, 8))
          setWalletAddress(mockWalletAddress)
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

  // Real-time APY updates with smooth, gradual transitions
  useEffect(() => {
    // Initialize with a random starting point in the range
    const minAPY = 14.5
    const maxAPY = 21.5
    const range = maxAPY - minAPY
    const startAPY = minAPY + (Math.random() * range)
    setCurrentAPY(startAPY)

    // Use a ref-like pattern to track current and target values
    let currentValue = startAPY
    let targetAPY = startAPY
    let updateCount = 0
    let targetChangeCounter = 0

    // Calculate how many updates we need for a 10-minute period
    const updatesPerMinute = 30 // Every 2 seconds = 30 updates per minute
    const updatesIn10Minutes = updatesPerMinute * 10 // 300 updates

    const apyInterval = setInterval(() => {
      updateCount++
      targetChangeCounter++

      // Choose a new target every 20-30 updates (40-60 seconds)
      // This ensures gradual direction changes with smooth transitions
      if (targetChangeCounter >= (20 + Math.floor(Math.random() * 11))) {
        // Pick a new target APY in the range
        // Ensure the new target is different enough to create visible movement
        const newTarget = minAPY + (Math.random() * range)
        // Only change if it's different enough (at least 0.5% difference)
        if (Math.abs(newTarget - targetAPY) > 0.5) {
          targetAPY = newTarget
        }
        targetChangeCounter = 0
      }

      // Smooth interpolation towards target (0.03 = very gradual, takes ~33 steps to reach target)
      // This ensures subtle, smooth transitions
      const smoothnessFactor = 0.03
      const difference = targetAPY - currentValue
      const increment = difference * smoothnessFactor

      // Update current value smoothly
      currentValue = currentValue + increment

      // Clamp to range to ensure it never goes outside bounds
      currentValue = Math.max(minAPY, Math.min(maxAPY, currentValue))

      // Update state with 2 decimal places
      setCurrentAPY(Math.round(currentValue * 100) / 100)

      // Reset after 10 minutes to start a new cycle
      if (updateCount >= updatesIn10Minutes) {
        updateCount = 0
        // Start fresh with a new random value in range
        currentValue = minAPY + (Math.random() * range)
        targetAPY = currentValue
      }
    }, 2000) // Update every 2 seconds

    return () => clearInterval(apyInterval)
  }, [])

  const balance = Number(vault?.balance || 0).toFixed(2)
  const maskedBalance = balance.replace(/\d/g, "*")

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
    setIsProfileSheetOpen(false)
  }

  const handleLanguageChange = (lang: "es" | "en") => {
    setLanguage(lang)
    // TODO: Save language preference
  }

  const handleCopyWalletAddress = async () => {
    try {
      await navigator.clipboard.writeText(walletAddress)
      setWalletCopied(true)
      setTimeout(() => setWalletCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy wallet address:", err)
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
    <div className="relative min-h-screen w-full overflow-hidden bg-black pb-8">
      {/* Falling Pattern Background */}
      <div className="absolute inset-0 z-0">
        <FallingPattern 
          className="h-full w-full" 
          backgroundColor="oklch(0 0 0)"
          color="oklch(1 0 0)"
        />
      </div>

      {/* Content */}
      <div className="relative z-10">
        <div className="container mx-auto px-6 py-12">
          {/* Balance Display Box */}
          <div className="mb-8">
            <div className="border border-white/20 rounded-lg p-8 text-center">
              <div className="text-sm text-white/60 mb-4">{t.totalBalance}</div>
              <div 
                className="text-6xl font-bold text-white cursor-pointer select-none flex items-center justify-center min-h-[4rem]"
                onClick={toggleBalanceVisibility}
              >
                {isBalanceVisible ? balance : maskedBalance}
              </div>
              {/* Real-time APY Display */}
              <div className="mt-2 text-xs text-white/50 font-normal">
                {t.todayAPY}: <span className="font-medium">{currentAPY.toFixed(2)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Trust Points - Bottom Left */}
        <button
          onClick={() => setIsTrustModalOpen(true)}
          className="fixed bottom-6 left-6 z-10"
        >
          <div className="px-4 py-2 rounded-full flex items-center gap-2 transition-colors cursor-pointer">
            <Award className="w-5 h-5 text-white" />
            <span className="text-white font-semibold">
              {trustPoints?.balance || 5} TRUST
            </span>
          </div>
        </button>

        {/* Wallet Icon - Bottom Right */}
        <button
          onClick={() => setIsProfileSheetOpen(true)}
          className="fixed bottom-6 right-6 z-10"
          aria-label={t.openProfile}
        >
          <div className="w-14 h-14 rounded-full flex items-center justify-center transition-colors cursor-pointer">
            <Wallet className="w-6 h-6 text-white" />
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
          className="bg-black border-white/20 text-white w-full sm:max-w-lg overflow-y-auto [&>button]:hidden"
        >
          {/* Back Button - Top Left */}
          <button
            onClick={() => setIsProfileSheetOpen(false)}
            className="absolute top-4 left-4 z-10 p-2 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 transition-colors"
            aria-label={t.closeProfile}
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>

          <SheetHeader className="pt-12 pb-4">
            <SheetTitle className="text-white text-2xl">{t.title}</SheetTitle>
            <SheetDescription className="text-white/60">
              {t.editProfile}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 px-4 pb-8">
            <Card className="border-white/20 bg-black">
              <CardHeader>
                <CardTitle className="text-white">{t.profilePicture}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Profile Picture */}
                <div className="flex items-center gap-6">
                  <Avatar className="w-24 h-24 border-2 border-white/20">
                    <AvatarImage src={profilePic || undefined} />
                    <AvatarFallback className="bg-white/10 text-white text-2xl">
                      {username.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    variant="outline"
                    className="border-2 border-white/20 bg-transparent text-white hover:bg-white/10"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    {t.changePicture}
                  </Button>
                </div>

                {/* Username */}
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-white">
                    {t.username}
                  </Label>
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
                  <Label className="text-white flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    {t.walletAddress}
                  </Label>
                  <div 
                    onClick={handleCopyWalletAddress}
                    className="p-4 bg-white/5 border border-white/10 rounded-lg cursor-pointer hover:bg-white/10 transition-colors"
                  >
                    <code className="text-sm text-white/80 font-mono break-all">
                      {walletAddress}
                    </code>
                  </div>
                  <p className={`text-sm ${walletCopied ? "text-green-400" : "text-white/60"}`}>
                    {walletCopied ? t.walletCopied : t.clickToCopy}
                  </p>
                </div>

                {/* Language Selection */}
                <div className="space-y-2">
                  <Label className="text-white flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    {t.language}
                  </Label>
                  <div className="flex gap-4">
                    <Button
                      variant="outline"
                      onClick={() => handleLanguageChange("es")}
                      className={`border-2 bg-transparent ${language === "es" ? "border-white text-white" : "border-white/20 text-white/60"} hover:bg-white/10`}
                    >
                      {t.spanish}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleLanguageChange("en")}
                      className={`border-2 bg-transparent ${language === "en" ? "border-white text-white" : "border-white/20 text-white/60"} hover:bg-white/10`}
                    >
                      {t.english}
                    </Button>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-4 pt-4">
                  <Button
                    onClick={handleSaveProfile}
                    variant="outline"
                    className="flex-1 border-2 border-white bg-transparent text-white hover:bg-white/10"
                  >
                    {t.save}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsProfileSheetOpen(false)}
                    className="flex-1 border-2 border-white/20 bg-transparent text-white hover:bg-white/10"
                  >
                    {t.cancel}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

