export type CreditStatus = "pending" | "approved" | "active" | "repaid" | "rejected"

export type MicrocreditProgramId =
  | "mujeres2000"
  | "emprende500"
  | "comunidad1k"
  | "rapido250"

export type UserCreditRecord = {
  id: string
  programId: MicrocreditProgramId | "legacy"
  programName: string
  amount: number
  currency: string
  status: CreditStatus
  appliedAt: string
  termDays?: number
}

export type CreditEligibilitySnapshot = {
  eligible: boolean
  trustworthyVouchesCount: number
  totalTrustPoints: number
  reason?: string | null
}

export type CreditsResponse = {
  credits: UserCreditRecord[]
  eligibility: CreditEligibilitySnapshot
}
