"use client"

import { useCallback, useEffect, useState } from "react"
import { ledgerUserHeaders } from "@/lib/ledger/client-headers"
import { getUserId } from "@/lib/wallet-utils"
import {
  createCreditApplication,
  readUserCreditApplications,
  saveUserCreditApplications,
} from "@/lib/credit/applications-storage"
import type { CreditEligibilitySnapshot, MicrocreditProgramId, UserCreditRecord } from "@/lib/credit/types"
import { getWalletTexts } from "@/lib/wallet-texts"
import { useWalletLanguage } from "@/lib/wallet-language"

function mergeCredits(serverCredits: UserCreditRecord[], localCredits: UserCreditRecord[]): UserCreditRecord[] {
  const byId = new Map<string, UserCreditRecord>()
  for (const credit of [...serverCredits, ...localCredits]) {
    byId.set(credit.id, credit)
  }
  return [...byId.values()].sort(
    (a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime(),
  )
}

export function useCredits() {
  const { language } = useWalletLanguage()
  const [credits, setCredits] = useState<UserCreditRecord[]>([])
  const [eligibility, setEligibility] = useState<CreditEligibilitySnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const userId = getUserId()
    if (!userId) {
      setCredits([])
      setEligibility(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const localCredits = readUserCreditApplications(userId)
      const res = await fetch("/api/wallet/credits", {
        headers: ledgerUserHeaders(),
        cache: "no-store",
      })

      if (res.ok) {
        const json = (await res.json()) as {
          credits?: UserCreditRecord[]
          eligibility?: CreditEligibilitySnapshot
        }
        setCredits(mergeCredits(json.credits ?? [], localCredits))
        setEligibility(json.eligibility ?? null)
      } else {
        setCredits(localCredits)
        setEligibility(null)
      }
    } catch {
      const userIdFallback = getUserId()
      setCredits(userIdFallback ? readUserCreditApplications(userIdFallback) : [])
      setError("fetch_failed")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh, language])

  const applyForProgram = useCallback(
    async (programId: MicrocreditProgramId) => {
      const userId = getUserId()
      if (!userId) return { ok: false as const, reason: "no_user" as const }

      setApplying(true)
      try {
        const t = getWalletTexts(language)
        const record = createCreditApplication(userId, programId, t)
        setCredits((prev) => mergeCredits(prev, [record]))
        return { ok: true as const, credit: record }
      } catch (e) {
        if (e instanceof Error && e.message === "already_applied") {
          return { ok: false as const, reason: "already_applied" as const }
        }
        return { ok: false as const, reason: "unknown" as const }
      } finally {
        setApplying(false)
      }
    },
    [language],
  )

  const syncLocalCredits = useCallback((next: UserCreditRecord[]) => {
    const userId = getUserId()
    if (!userId) return
    saveUserCreditApplications(userId, next.filter((c) => c.programId !== "legacy"))
    setCredits(next)
  }, [])

  return {
    credits,
    eligibility,
    loading,
    applying,
    error,
    refresh,
    applyForProgram,
    syncLocalCredits,
  }
}
