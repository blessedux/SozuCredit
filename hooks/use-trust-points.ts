/**
 * Custom hook for trust points functionality
 * Handles trust points fetching, vouching, and referral code management
 */

import { useState, useCallback, useEffect } from "react"
import { getUserId } from "@/lib/wallet-utils"
import { useWalletLanguage } from "@/lib/wallet-language"

export interface TrustPoints {
  balance: number
  last_daily_credit: string | null
}

export interface ReferralStats {
  totalReferrals: number
  totalPointsEarned: number
}

export function useTrustPoints() {
  const [trustPoints, setTrustPoints] = useState<TrustPoints | null>(null)
  const [modalView, setModalView] = useState<"main" | "invite" | "vouch">("main")
  const [vouchUsername, setVouchUsername] = useState("")
  const [vouchPoints, setVouchPoints] = useState("1")
  const [vouchLoading, setVouchLoading] = useState(false)
  const [inviteCode, setInviteCode] = useState("")
  const [referralLoading, setReferralLoading] = useState(false)
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null)
  const [inviteCodeCopied, setInviteCodeCopied] = useState(false)

  const { t } = useWalletLanguage()

  // Fetch trust points
  const fetchTrustPoints = useCallback(async () => {
    const userId = getUserId()
    if (!userId) return

    try {
      const trustResponse = await fetch("/api/wallet/trust-points", {
        headers: {
          "x-user-id": userId,
        },
      })

      if (trustResponse.ok) {
        const trustData = await trustResponse.json()
        setTrustPoints(trustData.trustPoints)
      } else {
        setTrustPoints({ balance: 0, last_daily_credit: null })
      }
    } catch (error) {
      console.error("[Trust Points] Error fetching trust points:", error)
      setTrustPoints({ balance: 0, last_daily_credit: null })
    }
  }, [])

  // Generate referral code
  const generateReferralCode = useCallback(async () => {
    const userId = getUserId()
    if (!userId) return

    setReferralLoading(true)
    try {
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
    } catch (referralError) {
      console.error("[Trust Points] Error generating referral code:", referralError)
    } finally {
      setReferralLoading(false)
    }
  }, [])

  // Handle vouch
  const handleVouch = useCallback(async () => {
    if (!vouchUsername.trim() || !vouchPoints) {
      return
    }

    setVouchLoading(true)
    try {
      const userId = getUserId()
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
      await fetchTrustPoints()

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
  }, [vouchUsername, vouchPoints, t, fetchTrustPoints])

  // Copy invite code
  const copyInviteCode = useCallback(async () => {
    if (!inviteCode) return

    try {
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
      setInviteCodeCopied(true)
      setTimeout(() => setInviteCodeCopied(false), 2000)
    } catch (err) {
      await navigator.clipboard.writeText(inviteCode)
      setInviteCodeCopied(true)
      setTimeout(() => setInviteCodeCopied(false), 2000)
    }
  }, [inviteCode, t])

  // Initialize trust points on mount
  useEffect(() => {
    fetchTrustPoints()
    generateReferralCode()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    // State
    trustPoints,
    modalView,
    vouchUsername,
    vouchPoints,
    vouchLoading,
    inviteCode,
    referralLoading,
    referralStats,
    inviteCodeCopied,
    // Actions
    setModalView,
    setVouchUsername,
    setVouchPoints,
    handleVouch,
    copyInviteCode,
    fetchTrustPoints,
  }
}
