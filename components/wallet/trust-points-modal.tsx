/**
 * Trust points modal component
 * Handles trust points display, invite codes, and vouching
 */

"use client"

import { memo } from "react"
import { Check, Copy } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useWalletLanguage } from "@/lib/wallet-language"
import { useTrustPoints } from "@/hooks/use-trust-points"

interface TrustPointsModalProps {
  isOpen: boolean
  onClose: () => void
}

export const TrustPointsModal = memo(function TrustPointsModal({
  isOpen,
  onClose,
}: TrustPointsModalProps) {
  const { t } = useWalletLanguage()
  const {
    trustPoints,
    modalView,
    vouchUsername,
    vouchPoints,
    vouchLoading,
    inviteCode,
    referralLoading,
    referralStats,
    inviteCodeCopied,
    setModalView,
    setVouchUsername,
    setVouchPoints,
    handleVouch,
    copyInviteCode,
  } = useTrustPoints()

  const handleCopyInviteCode = async () => {
    if (!inviteCode) return
    const inviteLink = typeof window !== "undefined" 
      ? `${window.location.origin}/auth?invite=${inviteCode}`
      : `https://sozucredit.com/auth?invite=${inviteCode}`
    
    let inviteMessage = t.inviteMessage
      .replace("{code}", inviteCode)
      .replace("{link}", inviteLink)
    
    if (!t.inviteMessage.includes("{link}")) {
      inviteMessage += `\n\n${inviteLink}`
    }
    
    await navigator.clipboard.writeText(inviteMessage)
    copyInviteCode()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
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
              <p className="text-sm text-white/80">{t.trustPointsDesc}</p>
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
              <p className="text-sm text-white/80">{t.inviteCodeDesc}</p>
            </div>

            {referralLoading ? (
              <div className="p-4 bg-white/5 border border-white/10 rounded-lg text-white/60 text-center">
                {t.loadingScore}
              </div>
            ) : inviteCode ? (
              <>
                <Button
                  onClick={handleCopyInviteCode}
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

                <div className="flex gap-2 justify-center">
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
                {t.errorLoadingScore}
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
              <p className="text-sm text-white/80">{t.vouchDesc}</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-white">{t.usernameLabel}</Label>
                <Input
                  id="username"
                  value={vouchUsername}
                  onChange={(e) => setVouchUsername(e.target.value)}
                  className="bg-black border-white/20 text-white"
                  placeholder={t.usernamePlaceholder}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="points" className="text-white">{t.pointsToSend}</Label>
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
  )
})
