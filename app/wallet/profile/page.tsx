"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Globe, User, Wallet, Camera, Link2, TrendingUp, Shield } from "lucide-react"
import { useRouter } from "next/navigation"

export default function ProfilePage() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [username, setUsername] = useState("")
  const [walletAddress, setWalletAddress] = useState("")
  const [evmAddress, setEvmAddress] = useState<string | null>(null)
  const [evmAddressInput, setEvmAddressInput] = useState("")
  const [isLinkingEVM, setIsLinkingEVM] = useState(false)
  const [egoScore, setEgoScore] = useState<any>(null)
  const [trustScore, setTrustScore] = useState<number | null>(null)
  const [isLoadingEgoScore, setIsLoadingEgoScore] = useState(false)
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
      evmAddress: "Dirección EVM (Ethereum)",
      evmAddressDesc: "Vincula tu dirección Ethereum para obtener tu puntuación de ego MaxFlow",
      linkEVMAddress: "Vincular Dirección EVM",
      unlinkEVMAddress: "Desvincular",
      linking: "Vinculando...",
      egoScore: "Puntuación de Ego",
      trustScore: "Puntuación de Confianza",
      loadingEgoScore: "Cargando...",
      noEVMAddress: "No hay dirección EVM vinculada",
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
      evmAddress: "EVM Address (Ethereum)",
      evmAddressDesc: "Link your Ethereum address to get your MaxFlow ego score",
      linkEVMAddress: "Link EVM Address",
      unlinkEVMAddress: "Unlink",
      linking: "Linking...",
      egoScore: "Ego Score",
      trustScore: "Trust Score",
      loadingEgoScore: "Loading...",
      noEVMAddress: "No EVM address linked",
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
    if (typeof window !== "undefined") {
      const checkAuth = () => {
        const authenticated = sessionStorage.getItem("dev_authenticated") === "true"
        
        if (!authenticated) {
          setTimeout(() => {
            const retryCheck = sessionStorage.getItem("dev_authenticated") === "true"
            if (!retryCheck) {
              window.location.replace("/auth")
            } else {
              loadProfile()
            }
          }, 1500)
        } else {
          loadProfile()
        }
      }
      
      const loadProfile = async () => {
        try {
          const userId = sessionStorage.getItem("dev_username")
          if (!userId) {
            window.location.replace("/auth")
            return
          }

          // Fetch profile data
          const profileResponse = await fetch("/api/wallet/profile", {
            headers: {
              "x-user-id": userId,
            },
          })
          const profileData = await profileResponse.json()
          
          if (profileData.profile) {
            setUsername(profileData.profile.username || profileData.profile.display_name || userId.substring(0, 8))
          } else {
            setUsername(userId.substring(0, 8))
          }

          // For now, generate a mock wallet address from user ID
          const mockWalletAddress = "0x" + userId.replace(/-/g, "").substring(0, 40).padEnd(40, "0")
          setWalletAddress(mockWalletAddress)

          // Fetch EVM address
          const evmResponse = await fetch("/api/wallet/evm-address", {
            headers: {
              "x-user-id": userId,
            },
          })
          const evmData = await evmResponse.json()
          
          if (evmData.evmAddress) {
            setEvmAddress(evmData.evmAddress)
            setEvmAddressInput(evmData.evmAddress)
            // Load ego score if EVM address exists (will be called after component mounts)
          }
          
          setIsAuthenticated(true)
        } catch (err) {
          console.error("[Profile] Error loading profile:", err)
        }
      }
      
      checkAuth()
    }
  }, [])

  // Load ego score when EVM address is available
  useEffect(() => {
    if (evmAddress && evmAddress.startsWith("0x")) {
      loadEgoScore(evmAddress)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evmAddress])

  const loadEgoScore = async (address: string) => {
    if (!address || !address.startsWith("0x")) return
    
    setIsLoadingEgoScore(true)
    try {
      const userId = sessionStorage.getItem("dev_username")
      if (!userId) return

      // Fetch ego score
      const egoResponse = await fetch(`/api/maxflow/ego/${address}/score`, {
        headers: {
          "x-user-id": userId,
        },
      })
      
      if (egoResponse.ok) {
        const egoData = await egoResponse.json()
        setEgoScore(egoData.egoScore)
      }

      // Fetch trust score
      const trustResponse = await fetch(`/api/maxflow/ego/${address}/trust-score`, {
        headers: {
          "x-user-id": userId,
        },
      })
      
      if (trustResponse.ok) {
        const trustData = await trustResponse.json()
        setTrustScore(trustData.trustScore)
      }
    } catch (err) {
      console.error("[Profile] Error loading ego score:", err)
    } finally {
      setIsLoadingEgoScore(false)
    }
  }

  const handleSave = async () => {
    // TODO: Save profile changes to backend
    console.log("Saving profile:", { username, language, profilePic })
    router.push("/wallet")
  }

  const handleLanguageChange = (lang: "es" | "en") => {
    setLanguage(lang)
    // TODO: Save language preference
  }

  const handleLinkEVMAddress = async () => {
    if (!evmAddressInput || !evmAddressInput.startsWith("0x")) {
      alert("Please enter a valid Ethereum address (0x...)")
      return
    }

    setIsLinkingEVM(true)
    try {
      const userId = sessionStorage.getItem("dev_username")
      if (!userId) {
        window.location.replace("/auth")
        return
      }

      const response = await fetch("/api/wallet/evm-address", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({ evmAddress: evmAddressInput }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setEvmAddress(evmAddressInput)
        // Load ego score after linking
        loadEgoScore(evmAddressInput)
      } else {
        alert(data.error || "Failed to link EVM address")
      }
    } catch (err) {
      console.error("[Profile] Error linking EVM address:", err)
      alert("Failed to link EVM address")
    } finally {
      setIsLinkingEVM(false)
    }
  }

  const handleUnlinkEVMAddress = async () => {
    try {
      const userId = sessionStorage.getItem("dev_username")
      if (!userId) {
        window.location.replace("/auth")
        return
      }

      const response = await fetch("/api/wallet/evm-address", {
        method: "DELETE",
        headers: {
          "x-user-id": userId,
        },
      })

      if (response.ok) {
        setEvmAddress(null)
        setEvmAddressInput("")
        setEgoScore(null)
        setTrustScore(null)
      } else {
        alert("Failed to unlink EVM address")
      }
    } catch (err) {
      console.error("[Profile] Error unlinking EVM address:", err)
      alert("Failed to unlink EVM address")
    }
  }

  const loadEgoScore = async (address: string) => {
    if (!address || !address.startsWith("0x")) return
    
    setIsLoadingEgoScore(true)
    try {
      const userId = sessionStorage.getItem("dev_username")
      if (!userId) return

      // Fetch ego score
      const egoResponse = await fetch(`/api/maxflow/ego/${address}/score`, {
        headers: {
          "x-user-id": userId,
        },
      })
      
      if (egoResponse.ok) {
        const egoData = await egoResponse.json()
        setEgoScore(egoData.egoScore)
      }

      // Fetch trust score
      const trustResponse = await fetch(`/api/maxflow/ego/${address}/trust-score`, {
        headers: {
          "x-user-id": userId,
        },
      })
      
      if (trustResponse.ok) {
        const trustData = await trustResponse.json()
        setTrustScore(trustData.trustScore)
      }
    } catch (err) {
      console.error("[Profile] Error loading ego score:", err)
    } finally {
      setIsLoadingEgoScore(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black dark text-white">
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black dark text-white">
      <div className="container mx-auto px-6 py-12 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">{t.title}</h1>
          <p className="text-white/60">{t.editProfile}</p>
        </div>

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

            {/* EVM Address Linking */}
            <div className="space-y-2">
              <Label className="text-white flex items-center gap-2">
                <Link2 className="w-4 h-4" />
                {t.evmAddress}
              </Label>
              {evmAddress ? (
                <div className="space-y-2">
                  <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                    <code className="text-sm text-white/80 font-mono break-all">
                      {evmAddress}
                    </code>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleUnlinkEVMAddress}
                    className="border-white/20 text-white hover:bg-white/10"
                  >
                    {t.unlinkEVMAddress}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    value={evmAddressInput}
                    onChange={(e) => setEvmAddressInput(e.target.value)}
                    className="bg-black border-white/20 text-white font-mono"
                    placeholder="0x..."
                  />
                  <Button
                    onClick={handleLinkEVMAddress}
                    disabled={isLinkingEVM || !evmAddressInput.startsWith("0x")}
                    className="w-full"
                  >
                    {isLinkingEVM ? t.linking : t.linkEVMAddress}
                  </Button>
                </div>
              )}
              <p className="text-sm text-white/60">{t.evmAddressDesc}</p>
            </div>

            {/* Ego Score & Trust Score */}
            {evmAddress && (
              <div className="space-y-4 pt-4 border-t border-white/10">
                <div className="space-y-2">
                  <Label className="text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    {t.egoScore}
                  </Label>
                  {isLoadingEgoScore ? (
                    <div className="p-4 bg-white/5 border border-white/10 rounded-lg text-white/60">
                      {t.loadingEgoScore}
                    </div>
                  ) : egoScore ? (
                    <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                      <div className="text-white font-semibold text-lg">
                        {egoScore.localHealth?.toFixed(2) || "N/A"}
                      </div>
                      {egoScore.metrics && (
                        <div className="text-sm text-white/60 mt-2">
                          <div>Total Nodes: {egoScore.metrics.totalNodes || 0}</div>
                          <div>Accepted Users: {egoScore.metrics.acceptedUsers || 0}</div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 bg-white/5 border border-white/10 rounded-lg text-white/60">
                      {t.noEVMAddress}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-white flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    {t.trustScore}
                  </Label>
                  {isLoadingEgoScore ? (
                    <div className="p-4 bg-white/5 border border-white/10 rounded-lg text-white/60">
                      {t.loadingEgoScore}
                    </div>
                  ) : trustScore !== null ? (
                    <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                      <div className="text-white font-semibold text-lg">
                        {trustScore.toFixed(2)}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-white/5 border border-white/10 rounded-lg text-white/60">
                      {t.noEVMAddress}
                    </div>
                  )}
                </div>
              </div>
            )}

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
                  className={`border-2 ${language === "es" ? "border-white text-white" : "border-white/20 text-white/60"} hover:bg-white/10`}
                >
                  {t.spanish}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleLanguageChange("en")}
                  className={`border-2 ${language === "en" ? "border-white text-white" : "border-white/20 text-white/60"} hover:bg-white/10`}
                >
                  {t.english}
                </Button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4 pt-4">
              <Button
                onClick={handleSave}
                className="flex-1"
              >
                {t.save}
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push("/wallet")}
                className="flex-1 border-white/20 text-white hover:bg-white/10"
              >
                {t.cancel}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

