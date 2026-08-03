"use client"

import type { ReactNode } from "react"
import { WalletLanguageProvider } from "@/lib/wallet-language"

export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return <WalletLanguageProvider>{children}</WalletLanguageProvider>
}
