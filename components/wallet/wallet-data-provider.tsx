"use client"

import { createContext, useContext, type ReactNode } from "react"
import { useWalletData } from "@/hooks/use-wallet-data"

type WalletDataContextValue = ReturnType<typeof useWalletData>

const WalletDataContext = createContext<WalletDataContextValue | null>(null)

/** Single wallet bootstrap for all shell panels (landing + history). */
export function WalletDataProvider({ children }: { children: ReactNode }) {
  const value = useWalletData()
  return <WalletDataContext.Provider value={value}>{children}</WalletDataContext.Provider>
}

export function useWalletDataContext(): WalletDataContextValue {
  const ctx = useContext(WalletDataContext)
  if (!ctx) {
    throw new Error("useWalletDataContext must be used within WalletDataProvider")
  }
  return ctx
}
