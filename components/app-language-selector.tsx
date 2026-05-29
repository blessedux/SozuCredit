"use client"

import { memo } from "react"
import { useWalletLanguage } from "@/lib/wallet-language"
import { cn } from "@/lib/utils"

export const AppLanguageSelector = memo(function AppLanguageSelector({
  className,
  variant = "compact",
}: {
  className?: string
  variant?: "compact" | "settings"
}) {
  const { language, setLanguage, t } = useWalletLanguage()
  const isSettings = variant === "settings"

  return (
    <div
      className={cn(
        "relative grid grid-cols-2 rounded-full border border-white/12 bg-black/40 p-0.5 backdrop-blur-md",
        isSettings && "p-1",
        className,
      )}
      role="group"
      aria-label={t.language}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0.5 w-[calc(50%-2px)] rounded-full bg-white/15 transition-[left] duration-300 ease-out",
          language === "es" ? "left-0.5" : "left-[calc(50%+1px)]",
          isSettings && "inset-y-1",
        )}
      />
      <button
        type="button"
        onClick={() => setLanguage("es")}
        className={cn(
          "relative z-10 rounded-full font-semibold transition-colors",
          isSettings
            ? "px-4 py-2.5 text-sm"
            : "px-3 py-1 text-[10px] uppercase tracking-wider",
          language === "es" ? "text-white" : "text-white/45 hover:text-white/70",
        )}
        aria-pressed={language === "es"}
      >
        {isSettings ? t.spanish : "ES"}
      </button>
      <button
        type="button"
        onClick={() => setLanguage("en")}
        className={cn(
          "relative z-10 rounded-full font-semibold transition-colors",
          isSettings
            ? "px-4 py-2.5 text-sm"
            : "px-3 py-1 text-[10px] uppercase tracking-wider",
          language === "en" ? "text-white" : "text-white/45 hover:text-white/70",
        )}
        aria-pressed={language === "en"}
      >
        {isSettings ? t.english : "EN"}
      </button>
    </div>
  )
})
