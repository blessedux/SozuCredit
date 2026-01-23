/**
 * Language context for wallet components
 * Provides language state and translations throughout the app
 */

"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react"
import { getWalletTexts, type WalletTexts } from "@/lib/wallet-texts"

type Language = "en" | "es"

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: WalletTexts
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function WalletLanguageProvider({ children }: { children: ReactNode }) {
  // Default to Spanish
  const [language, setLanguage] = useState<Language>("es")
  const t = getWalletTexts(language)

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useWalletLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    // Fallback to Spanish if context not available
    return {
      language: "es" as Language,
      setLanguage: () => {},
      t: getWalletTexts("es"),
    }
  }
  return context
}
