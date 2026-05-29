/**
 * Language context for wallet components
 * Persists preference to localStorage and syncs document lang.
 */

"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { getWalletTexts, type WalletTexts, type WalletLanguage } from "@/lib/wallet-texts"

const STORAGE_KEY = "sozu_app_language:v1"

interface LanguageContextType {
  language: WalletLanguage
  setLanguage: (lang: WalletLanguage) => void
  t: WalletTexts
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

function readStoredLanguage(): WalletLanguage {
  if (typeof window === "undefined") return "es"
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === "en" || stored === "es" ? stored : "es"
  } catch {
    return "es"
  }
}

export function WalletLanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<WalletLanguage>("es")

  useEffect(() => {
    setLanguageState(readStoredLanguage())
  }, [])

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const setLanguage = useCallback((lang: WalletLanguage) => {
    setLanguageState(lang)
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      // private browsing / quota
    }
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
    return {
      language: "es" as WalletLanguage,
      setLanguage: () => {},
      t: getWalletTexts("es"),
    }
  }
  return context
}

export type { WalletLanguage }
