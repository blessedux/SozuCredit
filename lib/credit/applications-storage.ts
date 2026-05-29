import type { MicrocreditProgramId, UserCreditRecord } from "@/lib/credit/types"
import { getMicrocreditProgram } from "@/lib/credit/programs"
import type { WalletTexts } from "@/lib/wallet-texts"
import { getCreditProgramName } from "@/lib/credit/program-labels"

const STORAGE_KEY = "sozu_credit_applications:v1"

type StoredApplications = Record<string, UserCreditRecord[]>

function readAll(): StoredApplications {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as StoredApplications
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function writeAll(data: StoredApplications): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // quota / private mode
  }
}

export function readUserCreditApplications(userId: string): UserCreditRecord[] {
  const all = readAll()
  return all[userId] ?? []
}

export function saveUserCreditApplications(userId: string, credits: UserCreditRecord[]): void {
  const all = readAll()
  all[userId] = credits
  writeAll(all)
}

export function createCreditApplication(
  userId: string,
  programId: MicrocreditProgramId,
  t: WalletTexts,
): UserCreditRecord {
  const program = getMicrocreditProgram(programId)
  if (!program) {
    throw new Error("Unknown program")
  }

  const existing = readUserCreditApplications(userId)
  const duplicate = existing.find(
    (c) =>
      c.programId === programId &&
      c.status !== "rejected" &&
      c.status !== "repaid",
  )
  if (duplicate) {
    throw new Error("already_applied")
  }

  const record: UserCreditRecord = {
    id: `app_${programId}_${Date.now()}`,
    programId,
    programName: getCreditProgramName(programId, t),
    amount: program.amount,
    currency: program.currency,
    status: "pending",
    appliedAt: new Date().toISOString(),
    termDays: program.termDays,
  }

  saveUserCreditApplications(userId, [record, ...existing])
  return record
}
