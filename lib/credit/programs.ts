import type { MicrocreditProgramId } from "@/lib/credit/types"

export type MicrocreditProgram = {
  id: MicrocreditProgramId
  available: boolean
  amount: number
  currency: string
  termDays: number
}

export const MICROCREDIT_PROGRAMS: MicrocreditProgram[] = [
  {
    id: "mujeres2000",
    available: true,
    amount: 2_000_000,
    currency: "CLP",
    termDays: 180,
  },
  {
    id: "emprende500",
    available: false,
    amount: 500,
    currency: "USD",
    termDays: 90,
  },
  {
    id: "comunidad1k",
    available: false,
    amount: 1_000,
    currency: "USD",
    termDays: 120,
  },
  {
    id: "rapido250",
    available: false,
    amount: 250,
    currency: "USD",
    termDays: 60,
  },
]

export function getMicrocreditProgram(id: MicrocreditProgramId): MicrocreditProgram | undefined {
  return MICROCREDIT_PROGRAMS.find((p) => p.id === id)
}
