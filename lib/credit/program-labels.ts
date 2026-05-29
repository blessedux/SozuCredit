import type { MicrocreditProgramId } from "@/lib/credit/types"
import type { WalletTexts } from "@/lib/wallet-texts"

export function getCreditProgramName(programId: MicrocreditProgramId | "legacy", t: WalletTexts): string {
  switch (programId) {
    case "mujeres2000":
      return t.creditProgramMujeres2000Name
    case "emprende500":
      return t.creditProgramEmprende500Name
    case "comunidad1k":
      return t.creditProgramComunidad1kName
    case "rapido250":
      return t.creditProgramRapido250Name
    default:
      return t.creditLegacyProgramName
  }
}

export function getCreditProgramDesc(programId: MicrocreditProgramId, t: WalletTexts): string {
  switch (programId) {
    case "mujeres2000":
      return t.creditProgramMujeres2000Desc
    case "emprende500":
      return t.creditProgramEmprende500Desc
    case "comunidad1k":
      return t.creditProgramComunidad1kDesc
    case "rapido250":
      return t.creditProgramRapido250Desc
  }
}

export function getCreditStatusLabel(status: string, t: WalletTexts): string {
  switch (status) {
    case "pending":
      return t.creditStatusPending
    case "approved":
      return t.creditStatusApproved
    case "active":
      return t.creditStatusActive
    case "repaid":
      return t.creditStatusRepaid
    case "rejected":
      return t.creditStatusRejected
    default:
      return status
  }
}
