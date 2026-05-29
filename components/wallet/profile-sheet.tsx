/**
 * Profile sheet component — 4-tab top menu
 * Tabs: Profile | Cash out | DeFi | Log out
 */

"use client"

import { memo, useState, useCallback, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { X, Copy, Check, Eye, EyeOff, Key, LogOut, TrendingUp, Banknote, User, Sparkles, Mail, Settings } from "lucide-react"
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useWalletLanguage } from "@/lib/wallet-language"
import { copyToClipboard, getUserId } from "@/lib/wallet-utils"
import { getPublicKeyFromSession } from "@/lib/storage/key-utils"

type Tab = "profile" | "cashout" | "defi" | "logout"

interface ProfileSheetProps {
  isOpen: boolean
  onClose: () => void
  username: string
  walletAddress: string
  walletNetwork: "testnet" | "mainnet"
  unreadCount: number
  onActivateWallet?: () => void
  /** When false, hide the testnet activation CTA (e.g. wallet already funded + USDC trustline). */
  showActivateWallet?: boolean
  onOpenNotifications: () => void
  onWalletCreated?: (publicKey: string, network: "testnet" | "mainnet") => void
  onSwipeHandlers?: {
    onTouchStart: (e: React.TouchEvent) => void
    onTouchMove: (e: React.TouchEvent) => void
    onTouchEnd: () => void
    onSheetTouchStart: (e: React.TouchEvent) => void
    onSheetTouchMove: (e: React.TouchEvent) => void
    onSheetTouchEnd: () => void
  }
}

// ----- Profile Tab -----
const ProfileTab = memo(function ProfileTab({
  username,
  walletAddress,
  effectiveWalletAddress,
  walletNetwork,
  onTagUpdated,
  onOpenLedger,
  onOpenSettings,
}: {
  username: string
  walletAddress: string
  effectiveWalletAddress: string
  walletNetwork: "testnet" | "mainnet"
  onTagUpdated: (newTag: string) => void
  onOpenLedger: () => void
  onOpenSettings: () => void
}) {
  const { t } = useWalletLanguage()

  // Tag editing
  const [tag, setTag] = useState(username)
  const [tagStatus, setTagStatus] = useState<"idle" | "checking" | "available" | "taken" | "error" | "own">("idle")
  const [tagMessage, setTagMessage] = useState("")
  const [isSavingTag, setIsSavingTag] = useState(false)
  const [tagSaveError, setTagSaveError] = useState("")
  const [tagSaved, setTagSaved] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Address + key reveal
  const [showAddress, setShowAddress] = useState(false)
  const [addressCopied, setAddressCopied] = useState(false)
  const [secretKey, setSecretKey] = useState<string | null>(null)
  const [isKeyRevealed, setIsKeyRevealed] = useState(false)
  const [keyCopied, setKeyCopied] = useState(false)

  // Reset key when component unmounts or username changes
  useEffect(() => {
    return () => {
      setSecretKey(null)
      setIsKeyRevealed(false)
    }
  }, [])

  const checkTagAvailability = useCallback(async (value: string) => {
    if (value === username) {
      setTagStatus("own")
      setTagMessage("This is your current tag")
      return
    }
    if (value.length < 3) {
      setTagStatus("idle")
      setTagMessage("")
      return
    }
    setTagStatus("checking")
    try {
      const res = await fetch("/api/auth/username/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: value }),
      })
      const data = await res.json()
      if (data.available) {
        setTagStatus("available")
        setTagMessage("Tag is available")
      } else {
        setTagStatus("taken")
        setTagMessage("Tag is already taken")
      }
    } catch {
      setTagStatus("error")
      setTagMessage("Unable to check availability")
    }
  }, [username])

  const handleTagChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^a-zA-Z0-9_]/g, "")
    setTag(value)
    setTagSaveError("")
    setTagSaved(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.length >= 3 && /^[a-zA-Z0-9_]+$/.test(value)) {
      debounceRef.current = setTimeout(() => checkTagAvailability(value), 400)
    } else {
      setTagStatus("idle")
      setTagMessage("")
    }
  }, [checkTagAvailability])

  const handleSaveTag = useCallback(async () => {
    if (tagStatus !== "available" && tagStatus !== "own") return
    if (tag === username) return
    setIsSavingTag(true)
    setTagSaveError("")
    try {
      const userId = getUserId()
      const res = await fetch("/api/wallet/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(userId ? { "x-user-id": userId } : {}),
        },
        body: JSON.stringify({ username: tag }),
      })
      const data = await res.json()
      if (!res.ok) {
        setTagSaveError(data.error || "Failed to update tag")
      } else {
        sessionStorage.setItem("dev_username_display", tag)
        localStorage.setItem("sozu_username", tag)
        onTagUpdated(tag)
        setTagStatus("own")
        setTagMessage("This is your current tag")
        setTagSaved(true)
        setTimeout(() => setTagSaved(false), 3000)
      }
    } catch {
      setTagSaveError("Network error. Please try again.")
    } finally {
      setIsSavingTag(false)
    }
  }, [tag, tagStatus, username, onTagUpdated])

  const handleCopyAddress = useCallback(async () => {
    if (!effectiveWalletAddress) return
    const ok = await copyToClipboard(effectiveWalletAddress)
    if (ok) {
      setAddressCopied(true)
      setTimeout(() => setAddressCopied(false), 2000)
    }
  }, [effectiveWalletAddress])

  const handleRevealKey = useCallback(async () => {
    try {
      const { retrieveKeypair } = await import("@/lib/storage/browser-keys")
      const { getCredentialIdFromSession } = await import("@/lib/storage/key-utils")
      const { Keypair } = await import("@stellar/stellar-sdk")
      const credentialId = getCredentialIdFromSession()
      const userId = getUserId()
      if (!credentialId) { alert("No credential ID found. Please log in again."); return }
      const keypair = await retrieveKeypair(credentialId, userId || undefined)
      if (!keypair) { alert("No keypair found. Please create a wallet first."); return }
      if (walletAddress && keypair.publicKey() !== walletAddress) {
        alert("⚠️ Key mismatch — the stored key does not match this wallet address.")
        return
      }
      const secret = keypair.secret()
      try {
        const verify = Keypair.fromSecret(secret)
        if (verify.publicKey() !== keypair.publicKey()) {
          alert("⚠️ Key verification failed.")
          return
        }
      } catch { alert("⚠️ Key verification failed."); return }
      setSecretKey(secret)
      setIsKeyRevealed(true)
    } catch (err) {
      console.error("[ProfileSheet] Error revealing key:", err)
      alert("Failed to retrieve private key. Please try again.")
    }
  }, [walletAddress])

  const handleCopyKey = useCallback(async () => {
    if (!secretKey) return
    const ok = await copyToClipboard(secretKey)
    if (ok) {
      setKeyCopied(true)
      setTimeout(() => setKeyCopied(false), 2000)
    }
  }, [secretKey])

  const isTagValid = tag.length >= 3 && tag.length <= 30 && /^[a-zA-Z0-9_]+$/.test(tag)
  const canSaveTag = isTagValid && (tagStatus === "available") && tag !== username

  const tagBorderColor =
    tagStatus === "available" ? "border-green-500/60" :
    tagStatus === "taken" ? "border-red-500/60" :
    tagStatus === "error" ? "border-yellow-500/60" :
    "border-white/20"

  const tagMessageColor =
    tagStatus === "available" ? "text-green-400" :
    tagStatus === "taken" ? "text-red-400" :
    tagStatus === "error" ? "text-yellow-400" :
    tagStatus === "own" ? "text-white/50" :
    "text-white/50"

  return (
    <div className="space-y-6 pt-2">
      {/* Tag editing */}
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-white/40 font-medium">Sozu Tag</p>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60 font-mono text-sm select-none">$</span>
          <Input
            value={tag}
            onChange={handleTagChange}
            maxLength={30}
            placeholder="your_tag"
            className={`pl-7 bg-white/5 text-white placeholder:text-white/30 font-mono ${tagBorderColor} focus:border-white/40`}
          />
          {tagStatus === "checking" && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
          )}
        </div>
        {tagMessage && <p className={`text-xs ${tagMessageColor}`}>{tagMessage}</p>}
        {tagSaveError && <p className="text-xs text-red-400">{tagSaveError}</p>}
        {tagSaved && <p className="text-xs text-green-400">Tag updated!</p>}
        <Button
          onClick={handleSaveTag}
          disabled={!canSaveTag || isSavingTag}
          className="w-full bg-white text-black hover:bg-white/90 disabled:opacity-30 font-semibold"
        >
          {isSavingTag ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-black/40 border-t-transparent rounded-full animate-spin" />
              Saving…
            </span>
          ) : "Save Tag"}
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-white/40 font-medium">Cashflow</p>
        <Button
          type="button"
          variant="outline"
          onClick={onOpenLedger}
          className="w-full bg-transparent border-white/20 text-white hover:bg-white/10 justify-start gap-2"
        >
          <Mail className="w-4 h-4 shrink-0" />
          Libro por correo (Vaults)
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onOpenSettings}
          className="w-full bg-transparent border-white/20 text-white hover:bg-white/10 justify-start gap-2"
        >
          <Settings className="w-4 h-4 shrink-0" />
          Ajustes (Gmail, cuenta)
        </Button>
      </div>

      {/* Copy Stellar Address */}
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-white/40 font-medium">Stellar Address</p>
        {effectiveWalletAddress ? (
          <>
            <Button
              onClick={handleCopyAddress}
              variant="outline"
              className="w-full bg-transparent border-white/20 text-white hover:bg-white/10 font-mono"
            >
              {addressCopied ? (
                <span className="flex items-center gap-2 text-green-400"><Check className="w-4 h-4" /> Copied!</span>
              ) : (
                <span className="flex items-center gap-2"><Copy className="w-4 h-4" /> Copy Stellar Address</span>
              )}
            </Button>
            {showAddress && (
              <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
                <code className="text-xs text-white/70 font-mono break-all">{effectiveWalletAddress}</code>
              </div>
            )}
            <button
              onClick={() => setShowAddress(v => !v)}
              className="text-xs text-white/40 hover:text-white/60 transition-colors underline underline-offset-2"
            >
              {showAddress ? "Hide address" : "Show full address"}
            </button>
          </>
        ) : (
          <p className="text-xs text-white/40">No wallet address found.</p>
        )}
      </div>

      {/* Private Key */}
      {walletAddress && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-white/40 font-medium flex items-center gap-1.5">
            <Key className="w-3 h-3" /> Private Key
          </p>
          {isKeyRevealed && secretKey ? (
            <div className="space-y-2">
              <div className="flex items-stretch gap-2">
                <div className="flex-1 overflow-auto rounded-lg border border-white/10 bg-black/40 p-3">
                  <code className="text-xs text-white/80 font-mono break-all select-text">{secretKey}</code>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyKey}
                  className="bg-transparent border-white/20 text-white hover:bg-white/10 flex-shrink-0"
                >
                  {keyCopied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-green-400/80">✓ Verified — matches wallet address.</p>
              <button
                onClick={() => { setIsKeyRevealed(false); setSecretKey(null) }}
                className="text-xs text-white/40 hover:text-white/60 transition-colors flex items-center gap-1"
              >
                <EyeOff className="w-3 h-3" /> Hide key
              </button>
            </div>
          ) : (
            <Button
              onClick={handleRevealKey}
              variant="outline"
              className="w-full bg-transparent border-white/20 text-white hover:bg-white/10"
            >
              <Eye className="w-4 h-4 mr-2" /> Show Private Key
            </Button>
          )}
          <p className="text-xs text-white/30">
            Never share your private key. Anyone with this key controls your wallet.
          </p>
        </div>
      )}
    </div>
  )
})

// ----- Placeholder tab (Cash out / Defy) -----
const PlaceholderTab = memo(function PlaceholderTab({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
        {icon}
      </div>
      <div className="space-y-1">
        <p className="text-white font-semibold text-lg">{title}</p>
        <p className="text-white/50 text-sm max-w-xs">{description}</p>
      </div>
      <Button
        disabled
        variant="outline"
        className="border-white/20 text-white/40 bg-transparent cursor-not-allowed"
      >
        Próximamente
      </Button>
    </div>
  )
})

// ----- Logout Tab -----
const LogoutTab = memo(function LogoutTab({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-6">
      <div className="text-center space-y-2">
        <p className="text-white font-semibold">Log out of Sozu Wallet?</p>
        <p className="text-white/50 text-sm">Your passkey stays on this device. You can log back in anytime.</p>
      </div>
      <Button
        onClick={onLogout}
        className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold"
      >
        <LogOut className="w-4 h-4 mr-2" />
        Log Out
      </Button>
    </div>
  )
})

// ----- Main sheet -----
export const ProfileSheet = memo(function ProfileSheet({
  isOpen,
  onClose,
  username: initialUsername,
  walletAddress,
  walletNetwork,
  unreadCount,
  onActivateWallet,
  showActivateWallet = true,
  onOpenNotifications,
  onWalletCreated,
  onSwipeHandlers,
}: ProfileSheetProps) {
  const router = useRouter()
  const { t } = useWalletLanguage()
  const effectiveWalletAddress = walletAddress || getPublicKeyFromSession() || ""
  const [activeTab, setActiveTab] = useState<Tab>("profile")
  const [currentUsername, setCurrentUsername] = useState(initialUsername)

  // Sync if parent username changes (e.g. on mount)
  useEffect(() => {
    setCurrentUsername(initialUsername)
  }, [initialUsername])

  const handleClose = useCallback((open: boolean) => {
    if (!open) {
      setActiveTab("profile")
      onClose()
    }
  }, [onClose])

  const handleLogout = useCallback(() => {
    if (confirm(t.logoutConfirm)) {
      sessionStorage.clear()
      window.location.replace("/auth")
    }
  }, [t])

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "profile", label: "Profile", icon: <User className="w-3.5 h-3.5" /> },
    { id: "cashout", label: "Cash out", icon: <Banknote className="w-3.5 h-3.5" /> },
    { id: "defi", label: "DeFi", icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { id: "logout", label: "Log out", icon: <LogOut className="w-3.5 h-3.5" /> },
  ]

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent
        side="right"
        className="bg-black border-white/20 text-white w-screen sm:max-w-md overflow-y-auto touch-pan-y flex flex-col"
        onTouchStart={onSwipeHandlers?.onSheetTouchStart}
        onTouchMove={onSwipeHandlers?.onSheetTouchMove}
        onTouchEnd={onSwipeHandlers?.onSheetTouchEnd}
        style={{ touchAction: "pan-y" }}
      >
        <SheetTitle className="sr-only">Profile Settings</SheetTitle>
        <SheetDescription className="sr-only">
          Manage your profile, wallet address, and account settings
        </SheetDescription>

        {/* Header (full-screen on mobile) */}
        <div className="flex items-center justify-between gap-3 pt-6 px-4 pb-4">
          <h2 className="text-xl font-bold text-white truncate">${currentUsername || "…"}</h2>
          <button
            onClick={() => handleClose(false)}
            className="p-2 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 transition-colors flex-shrink-0"
            aria-label={t.closeProfile}
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="px-4 pb-4">
          <div className="grid grid-cols-4 gap-1 bg-white/5 rounded-xl p-1 border border-white/10">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-xs font-medium transition-all duration-150 ${
                  activeTab === tab.id
                    ? "bg-white/15 text-white border border-white/20"
                    : "text-white/50 hover:text-white/70"
                } ${tab.id === "logout" ? "text-red-400 hover:text-red-300" : ""}`}
              >
                {tab.icon}
                <span className="leading-none">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Primary actions */}
        {walletNetwork === "testnet" && onActivateWallet && showActivateWallet && (
          <div className="px-4 pb-4">
            <Button
              onClick={onActivateWallet}
              className="w-full bg-white text-black hover:bg-white/90 font-semibold h-12 rounded-xl"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Activar billetera
            </Button>
          </div>
        )}

        {/* Tab content */}
        <div className="flex-1 px-4 pb-8">
          {activeTab === "profile" && (
            <ProfileTab
              username={currentUsername}
              walletAddress={walletAddress}
              effectiveWalletAddress={effectiveWalletAddress}
              walletNetwork={walletNetwork}
              onTagUpdated={(newTag) => setCurrentUsername(newTag)}
              onOpenLedger={() => {
                onClose()
                router.push("/ledger")
              }}
              onOpenSettings={() => {
                onClose()
                router.push("/settings")
              }}
            />
          )}
          {activeTab === "cashout" && (
            <PlaceholderTab
              icon={<Banknote className="w-6 h-6 text-white/50" />}
              title="Cash Out"
              description="Convert your USDC to local currency and withdraw to your bank account."
            />
          )}
          {activeTab === "defi" && (
            <PlaceholderTab
              icon={<TrendingUp className="w-6 h-6 text-white/50" />}
              title="DeFi"
              description="Earn up to 15% APY on your USDC through DeFi protocols on Stellar."
            />
          )}
          {activeTab === "logout" && (
            <LogoutTab onLogout={handleLogout} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
})
