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
  
  // Profile state
  const [username, setUsername] = useState("")
  const [walletAddress, setWalletAddress] = useState("")
  const [language, setLanguage] = useState<"es" | "en">("es")
  const [profilePic, setProfilePic] = useState<string | null>(null)
  
  const texts = {
    es: {
      title: "Mi Perfil",
      editProfile: "Editar Perfil",
      username: "Nombre de Usuario",
      profilePicture: "Foto de Perfil",
      walletAddress: "Dirección de Billetera",
      walletAddressDesc: "Tu dirección privada de billetera",
      language: "Idioma",
      save: "Guardar",
      cancel: "Cancelar",
      english: "Inglés",
      spanish: "Español",
      changePicture: "Cambiar Foto",
    },
    en: {
      title: "My Profile",
      editProfile: "Edit Profile",
      username: "Username",
      profilePicture: "Profile Picture",
      walletAddress: "Wallet Address",
      walletAddressDesc: "Your private wallet address",
      language: "Language",
      save: "Save",
      cancel: "Cancel",
      english: "English",
      spanish: "Spanish",
      changePicture: "Change Picture",
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
        throw new Error("Usuario no autenticado")
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
        throw new Error(error.error || "Error al enviar puntos")
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
      alert("Puntos de confianza enviados exitosamente")
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al enviar puntos")
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
              <div className="text-sm text-white/60 mb-4">Saldo Total</div>
              <div 
                className="text-6xl font-bold text-white cursor-pointer select-none flex items-center justify-center min-h-[4rem]"
                onClick={toggleBalanceVisibility}
              >
                {isBalanceVisible ? balance : maskedBalance}
              </div>
            </div>
          </div>
        </div>

        {/* Trust Points - Bottom Left */}
        <button
          onClick={() => setIsTrustModalOpen(true)}
          className="fixed bottom-6 left-6 z-10"
        >
          <div className="px-4 py-2 rounded-full bg-white/10 border border-white/20 flex items-center gap-2 hover:bg-white/20 transition-colors cursor-pointer">
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
          aria-label="Abrir perfil"
        >
          <div className="w-14 h-14 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer">
            <Wallet className="w-6 h-6 text-white" />
          </div>
        </button>
      </div>

      {/* Trust Points Modal */}
      <Dialog open={isTrustModalOpen} onOpenChange={setIsTrustModalOpen}>
        <DialogContent className="bg-black border-white/20 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white text-2xl">Puntos de Confianza</DialogTitle>
            <DialogDescription className="text-white/60">
              Tu saldo actual: <span className="font-bold text-white">{trustPoints?.balance || 5} TRUST</span>
            </DialogDescription>
          </DialogHeader>

          {modalView === "main" && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-white">¿Qué son los Puntos de Confianza?</h3>
                <p className="text-sm text-white/80">
                  Los puntos de confianza son una medida de tu reputación en la plataforma. 
                  Puedes usarlos para apoyar a otros usuarios o aumentar tu elegibilidad para créditos.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-white">¿Cómo obtener más puntos?</h3>
                <ul className="text-sm text-white/80 space-y-1 list-disc list-inside">
                  <li>Espera para reclamar tu bono diario</li>
                  <li>Invita nuevos usuarios con tu código de invitación</li>
                  <li>Recibe puntos de otros usuarios que te apoyen</li>
                </ul>
              </div>

              <div className="flex flex-col gap-2 pt-4">
                <Button
                  onClick={() => setModalView("invite")}
                  className="w-full"
                >
                  Ver Código de Invitación
                </Button>
                <Button
                  onClick={() => setModalView("vouch")}
                  variant="outline"
                  className="w-full border-white/20 text-white hover:bg-white/10"
                >
                  Apoyar a un Usuario
                </Button>
              </div>
            </div>
          )}

          {modalView === "invite" && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-white">Tu Código de Invitación</h3>
                <p className="text-sm text-white/80">
                  Comparte este código con nuevos usuarios. Cuando se registren, ambos recibirán puntos adicionales.
                </p>
              </div>

              <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                <code className="text-xl font-bold text-white font-mono tracking-wider">
                  {inviteCode}
                </code>
              </div>

              <Button
                onClick={() => {
                  navigator.clipboard.writeText(inviteCode)
                  alert("Código copiado al portapapeles")
                }}
                variant="outline"
                className="w-full border-white/20 text-white hover:bg-white/10"
              >
                Copiar Código
              </Button>

              <Button
                onClick={() => setModalView("main")}
                variant="ghost"
                className="w-full text-white/60 hover:text-white hover:bg-white/5"
              >
                Volver
              </Button>
            </div>
          )}

          {modalView === "vouch" && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-white">Apoyar a un Usuario</h3>
                <p className="text-sm text-white/80">
                  Ingresa el nombre de usuario y envía puntos de confianza para apoyarlos.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-white">
                    Nombre de Usuario
                  </Label>
                  <Input
                    id="username"
                    value={vouchUsername}
                    onChange={(e) => setVouchUsername(e.target.value)}
                    className="bg-black border-white/20 text-white"
                    placeholder="Nombre de usuario"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="points" className="text-white">
                    Puntos a Enviar
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
                    Disponible: {trustPoints?.balance || 5} TRUST
                  </p>
                </div>

                <Button
                  onClick={handleVouch}
                  disabled={vouchLoading || !vouchUsername.trim() || !vouchPoints}
                  className="w-full"
                >
                  {vouchLoading ? "Enviando..." : "Enviar Puntos"}
                </Button>

                <Button
                  onClick={() => {
                    setModalView("main")
                    setVouchUsername("")
                    setVouchPoints("1")
                  }}
                  variant="ghost"
                  className="w-full text-white/60 hover:text-white hover:bg-white/5"
                >
                  Cancelar
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
            aria-label="Cerrar perfil"
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
                    className="border-white/20 text-white hover:bg-white/10"
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
                  <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                    <code className="text-sm text-white/80 font-mono break-all">
                      {walletAddress}
                    </code>
                  </div>
                  <p className="text-sm text-white/60">{t.walletAddressDesc}</p>
                </div>

                {/* Language Selection */}
                <div className="space-y-2">
                  <Label className="text-white flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    {t.language}
                  </Label>
                  <div className="flex gap-4">
                    <Button
                      variant={language === "es" ? "default" : "outline"}
                      onClick={() => handleLanguageChange("es")}
                      className={language === "es" ? "" : "border-white/20 text-white hover:bg-white/10"}
                    >
                      {t.spanish}
                    </Button>
                    <Button
                      variant={language === "en" ? "default" : "outline"}
                      onClick={() => handleLanguageChange("en")}
                      className={language === "en" ? "" : "border-white/20 text-white hover:bg-white/10"}
                    >
                      {t.english}
                    </Button>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-4 pt-4">
                  <Button
                    onClick={handleSaveProfile}
                    className="flex-1"
                  >
                    {t.save}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsProfileSheetOpen(false)}
                    className="flex-1 border-white/20 text-white hover:bg-white/10"
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

