"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Globe, User, Wallet, Camera } from "lucide-react"
import { useRouter } from "next/navigation"

export default function ProfilePage() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [username, setUsername] = useState("")
  const [walletAddress, setWalletAddress] = useState("")
  const [language, setLanguage] = useState<"es" | "en">("es")
  const [profilePic, setProfilePic] = useState<string | null>("/capybara_pfp.png")

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

          // For now, generate a mock wallet address from user ID
          const mockWalletAddress = "0x" + userId.replace(/-/g, "").substring(0, 40).padEnd(40, "0")
          
          setUsername(userId.substring(0, 8))
          setWalletAddress(mockWalletAddress)
          setIsAuthenticated(true)
        } catch (err) {
          console.error("[Profile] Error loading profile:", err)
        }
      }
      
      checkAuth()
    }
  }, [])

  const handleSave = async () => {
    // TODO: Save profile changes to backend
    console.log("Saving profile:", { username, language, profilePic })
    router.push("/wallet")
  }

  const handleLanguageChange = (lang: "es" | "en") => {
    setLanguage(lang)
    // TODO: Save language preference
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
                <AvatarImage src={profilePic || "/capybara_pfp.png"} />
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

