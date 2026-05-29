"use client"

import { WalletLanguageProvider } from "@/lib/wallet-language"

export default function CreditLayout({ children }: { children: React.ReactNode }) {
  return <WalletLanguageProvider>{children}</WalletLanguageProvider>
}
