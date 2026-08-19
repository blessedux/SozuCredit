"use client"

import { useWalletLanguage } from "@/lib/wallet-language"

export default function KycReturnPage() {
  const { t } = useWalletLanguage()
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-black px-6 text-center">
      <h1 className="text-lg font-medium text-white">{t.rampKycReturnTitle}</h1>
      <p className="text-sm text-white/60">{t.rampKycReturnBody}</p>
    </main>
  )
}
