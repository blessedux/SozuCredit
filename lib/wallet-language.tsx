/**
 * Language context for wallet components
 * Persists preference to localStorage and syncs document lang.
 * Default language follows browser preference (not hardcoded Spanish).
 */

"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { getWalletTexts, type WalletTexts, type WalletLanguage } from "@/lib/wallet-texts"
import {
  detectBrowserLanguage,
  persistAppLanguage,
  resolveAppLanguage,
} from "@/lib/locale"

interface LanguageContextType {
  language: WalletLanguage
  setLanguage: (lang: WalletLanguage) => void
  t: WalletTexts
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function WalletLanguageProvider({ children }: { children: ReactNode }) {
  // Browser-aware default; avoids forcing Spanish for en-* users.
  const [language, setLanguageState] = useState<WalletLanguage>(() =>
    typeof window === "undefined" ? "en" : resolveAppLanguage(),
  )

  useEffect(() => {
    setLanguageState(resolveAppLanguage())
  }, [])

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const setLanguage = useCallback((lang: WalletLanguage) => {
    setLanguageState(lang)
    persistAppLanguage(lang)
  }, [])

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
    const language = typeof window === "undefined" ? "en" : detectBrowserLanguage()
    return {
      language,
      setLanguage: () => {},
      t: getWalletTexts(language),
    }
  }
  return context
}

export type { WalletLanguage }
