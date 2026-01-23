/**
 * Profile sheet component
 * Displays wallet address, secret key, account diagnostics, and settings
 */

"use client"

import { memo, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { ArrowLeft, Wallet as WalletIcon, Key, Eye, Copy, Check, Bell, LogOut, Settings, CreditCard, Shield, User, ChevronRight } from "lucide-react"
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { getWalletTexts } from "@/lib/wallet-texts"
import { formatAddress, copyToClipboard, getStellarExpertUrl, getUserId } from "@/lib/wallet-utils"

const WalletCreator = dynamic(
  () => import("@/components/wallet-creator").then((mod) => ({ default: mod.WalletCreator })),
  {
    ssr: false,
    loading: () => <div className="h-32 w-full bg-gray-200 animate-pulse rounded" />,
  }
)

interface AccountDiagnostics {
  xlmBalance: number | null
  hasTrustline: boolean
  network: "testnet" | "mainnet" | null
  usdcIssuer: string | null
}

interface ProfileSheetProps {
  isOpen: boolean
  onClose: () => void
  username: string
  walletAddress: string
  walletNetwork: "testnet" | "mainnet"
  unreadCount: number
  onOpenNotifications: () => void
  onWalletCreated?: (publicKey: string, network: "testnet" | "mainnet") => void
  onSwipeHandlers?: {
    onTouchStart: (e: React.TouchEvent) => void
    onTouchMove: (e: React.TouchEvent) => void
    onTouchEnd: () => void
  }
}

export const ProfileSheet = memo(function ProfileSheet({
  isOpen,
  onClose,
  username,
  walletAddress,
  walletNetwork,
  unreadCount,
  onOpenNotifications,
  onWalletCreated,
  onSwipeHandlers,
}: ProfileSheetProps) {
  const router = useRouter()
  const t = getWalletTexts("es")
  const [secretKey, setSecretKey] = useState<string | null>(null)
  const [isSecretKeyExposed, setIsSecretKeyExposed] = useState(false)
  const [secretKeyCopied, setSecretKeyCopied] = useState(false)
  const [accountDiagnostics, setAccountDiagnostics] = useState<AccountDiagnostics | null>(null)
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false)

  // Reset secret key when sheet closes
  const handleClose = useCallback((open: boolean) => {
    if (!open) {
      setSecretKey(null)
      setIsSecretKeyExposed(false)
      setSecretKeyCopied(false)
      onClose()
    }
  }, [onClose])

  const handleCopyWalletAddress = useCallback(async () => {
    if (!walletAddress) return
    const success = await copyToClipboard(walletAddress)
    if (success) {
      alert(t.walletCopied)
    }
  }, [walletAddress, t])

  const handleOpenStellarExpert = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (!walletAddress) return
    const url = getStellarExpertUrl(walletAddress, walletNetwork)
    window.open(url, "_blank", "noopener,noreferrer")
  }, [walletAddress, walletNetwork])

  const handleExposeSecretKey = useCallback(async () => {
    try {
      const { retrieveKeypair } = await import("@/lib/storage/browser-keys")
      const { getCredentialIdFromSession } = await import("@/lib/storage/key-utils")
      const { Keypair } = await import("@stellar/stellar-sdk")

      const credentialId = getCredentialIdFromSession()
      const userId = getUserId()

      if (!credentialId) {
        alert("No se encontró ID de credencial. Por favor inicia sesión de nuevo.")
        return
      }

      const keypair = await retrieveKeypair(credentialId, userId || undefined)

      if (!keypair) {
        alert("No se encontró keypair. Por favor crea una billetera primero.")
        return
      }

      const publicKeyFromKeypair = keypair.publicKey()
      if (walletAddress && publicKeyFromKeypair !== walletAddress) {
        console.error("[Wallet] ⚠️ Keypair mismatch!")
        alert(`⚠️ ADVERTENCIA: ¡La clave secreta no coincide con la dirección de la billetera!\n\nDirección de Billetera: ${walletAddress}\nClave Pública del Keypair: ${publicKeyFromKeypair}\n\nEsta clave secreta no puede usarse para firmar transacciones para esta billetera.`)
        return
      }

      const secret = keypair.secret()

      // Verify secret key
      try {
        const verifyKeypair = Keypair.fromSecret(secret)
        if (verifyKeypair.publicKey() !== publicKeyFromKeypair) {
          console.error("[Wallet] ⚠️ La verificación de la clave secreta falló!")
          alert("⚠️ La verificación de la clave secreta falló. La clave secreta no puede recrear la clave pública.")
          return
        }
        console.log("[Wallet] ✅ Clave secreta verificada - coincide con la dirección de la billetera:", walletAddress)
      } catch (verifyError) {
        console.error("[Wallet] ⚠️ Error al verificar la clave secreta:", verifyError)
        alert("⚠️ Falló la verificación de la clave secreta. Puede ser inválida.")
        return
      }

      setSecretKey(secret)
      setIsSecretKeyExposed(true)
      console.log("[Wallet] Clave secreta expuesta y verificada")
    } catch (error) {
      console.error("[Wallet] Error al exponer la clave secreta:", error)
      alert("Falló la recuperación de la clave secreta. Por favor intenta de nuevo.")
    }
  }, [walletAddress])

  const handleCopySecretKey = useCallback(async () => {
    if (!secretKey) return
    const success = await copyToClipboard(secretKey)
    if (success) {
      setSecretKeyCopied(true)
      setTimeout(() => setSecretKeyCopied(false), 2000)
    }
  }, [secretKey])

  const handleCheckAccountDiagnostics = useCallback(async () => {
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

      const xlmBalance = status.balances.find(b => b.asset === "XLM")
      const balanceValue = xlmBalance ? parseFloat(xlmBalance.balance) : 0

      setAccountDiagnostics({
        xlmBalance: balanceValue,
        hasTrustline: status.hasUSDCTrustline,
        network: status.network,
        usdcIssuer: usdcIssuer,
      })

      console.log("[Wallet Diagnostics]", {
        network: status.network,
        xlmBalance: balanceValue,
        hasTrustline: status.hasUSDCTrustline,
        usdcIssuer,
      })
    } catch (error: any) {
      console.error("[Wallet] Error checking account diagnostics:", error)
      const errorMsg = error?.response?.data?.detail || error?.message || "Unknown error"
      alert(`Failed to check account status:\n\n${errorMsg}\n\nMake sure:\n1. Your account is funded\n2. You're connected to the correct network`)
    } finally {
      setLoadingDiagnostics(false)
    }
  }, [walletAddress])

  const handleLogout = useCallback(() => {
    if (confirm(t.logoutConfirm)) {
      sessionStorage.clear()
      window.location.replace("/auth")
    }
  }, [t])

  const handleWalletCreated = useCallback(async (publicKey: string, network: "testnet" | "mainnet") => {
    console.log("[Wallet] ✅ Wallet created via WalletCreator:", publicKey, network)
    if (onWalletCreated) {
      onWalletCreated(publicKey, network)
    }
  }, [onWalletCreated])

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent
        side="right"
        className="bg-black border-white/20 text-white w-full sm:max-w-lg overflow-y-auto [&>button]:hidden touch-pan-y"
        onTouchStart={onSwipeHandlers?.onTouchStart}
        onTouchMove={onSwipeHandlers?.onTouchMove}
        onTouchEnd={onSwipeHandlers?.onTouchEnd}
        style={{ touchAction: 'pan-y' }}
      >
        <SheetTitle className="sr-only">Profile Settings</SheetTitle>
        <SheetDescription className="sr-only">
          Manage your profile, wallet address, and account settings
        </SheetDescription>

        <button
          onClick={() => handleClose(false)}
          className="absolute top-4 left-4 z-10 p-2 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 transition-colors"
          aria-label={t.closeProfile}
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>

        <div className="px-4 pt-8 pb-4 text-center">
          <h2 className="text-2xl font-bold text-white">
            ${username || t.loadingScore}
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
                      ? formatAddress(walletAddress, 8, 8)
                      : "Wallet address will be available after registration..."}
                  </code>
                  <div
                    onClick={handleOpenStellarExpert}
                    className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 text-white/60 hover:text-white cursor-pointer"
                  >
                    <WalletIcon className="w-3 h-3" />
                    <span className="text-xs">{t.addy}</span>
                  </div>
                </div>
                {walletAddress && (
                  <p className="text-xs text-white/60 mt-2">
                    {t.fundYourAddress}
                  </p>
                )}
              </div>

              {/* Secret Key */}
              {walletAddress && (
                <div className="space-y-2 pt-4 border-t border-white/20">
                  <Label className="text-white/80 text-sm flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    Clave Secreta
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
                          <span className="text-xs text-white/60 ml-2">
                            Verificado: La clave secreta coincide con la dirección de la billetera
                          </span>
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
                    {t.createWalletDesc}
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
                          {t.checking}
                        </>
                      ) : (
                        t.checkAccountStatus
                      )}
                    </Button>

                    {accountDiagnostics && (
                      <div className="mt-3 p-3 bg-white/5 border border-white/10 rounded-lg space-y-2">
                        <div className="text-xs text-white/80">
                          <strong>{t.network}</strong> {accountDiagnostics.network?.toUpperCase() || t.notFound}
                        </div>
                        <div className="text-xs text-white/80">
                          <strong>{t.xlmBalance}</strong> {accountDiagnostics.xlmBalance !== null ? `${accountDiagnostics.xlmBalance.toFixed(7)} XLM` : t.notFound}
                        </div>
                        {accountDiagnostics.xlmBalance !== null && accountDiagnostics.xlmBalance < 1.5 && (
                          <div className="text-xs text-yellow-400">
                            ⚠️ {t.lowBalance}
                          </div>
                        )}
                        <div className="text-xs text-white/80">
                          <strong>{t.usdcTrustline}</strong> {accountDiagnostics.hasTrustline ? `✅ ${t.exists}` : `❌ ${t.notFound}`}
                        </div>
                        <div className="text-xs text-white/60 break-all">
                          <strong>{t.usdcIssuer}</strong> {accountDiagnostics.usdcIssuer || t.notFound}
                        </div>
                        {!accountDiagnostics.hasTrustline && (
                          <div className="text-xs text-white/60 mt-2 pt-2 border-t border-white/10">
                            <strong>{t.forStellarLab}</strong>
                            <ul className="list-disc list-inside mt-1 space-y-1">
                              <li>{t.selectNetwork} <strong>{accountDiagnostics.network?.toUpperCase() || "TESTNET"}</strong></li>
                              <li>{t.useIssuer} <code className="text-xs">{accountDiagnostics.usdcIssuer?.substring(0, 20)}...</code></li>
                              <li>{t.ensureBalance}</li>
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Wallet Creator */}
              {(!walletAddress || walletAddress === "") && (
                <div className="space-y-2 pt-4 border-t border-white/20">
                  <p className="text-xs text-white/60 mb-2">
                    {t.createWalletDesc}
                  </p>
                  <div className="bg-black/50 rounded-lg p-4 border border-white/10">
                    <WalletCreator
                      compact={true}
                      onWalletCreated={handleWalletCreated}
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
                handleClose(false)
                onOpenNotifications()
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

          {/* Settings Button */}
          <div className="pt-4 border-t border-white/20 mt-4">
            <button
              onClick={() => {
                handleClose(false)
                router.push("/settings")
              }}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-white/60 hover:text-white"
              aria-label={t.settings}
            >
              <Settings className="w-4 h-4" />
              <span className="text-sm">{t.settings}</span>
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
})
