"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowLeft, BookOpen, Table2, Target, Vault } from "lucide-react"
import { useAppHaptics } from "@/hooks/use-app-haptics"

const links = [
  { href: "/ledger", label: "Resumen", icon: BookOpen },
  { href: "/ledger/transactions", label: "Movimientos", icon: Table2 },
  { href: "/ledger/vaults", label: "Vaults", icon: Vault },
  { href: "/ledger/goals", label: "Metas", icon: Target },
]

/** Shared horizontal gutter + max width; vertical padding per block below */
const ledgerMainWidth =
  "mx-auto w-full max-w-lg px-4 sm:px-5 lg:max-w-7xl xl:max-w-[1400px] lg:px-8 xl:px-10"

export default function LedgerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { play: hapticNav } = useAppHaptics()

  return (
    <div className="relative z-10 min-h-screen bg-black text-white pb-28">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/40 backdrop-blur-md">
        <div className={`${ledgerMainWidth} flex items-center gap-3 pb-3 pt-4`}>
          <Link
            href="/wallet"
            className="p-2 rounded-full bg-white/10 border border-white/15 hover:bg-white/15 transition-colors"
            aria-label="Volver al wallet"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">Libro por correo</h1>
            <p className="text-xs text-white/50 truncate">Gastos e ingresos detectados — no es saldo on-chain</p>
          </div>
        </div>
        <nav className={`${ledgerMainWidth} flex gap-1 pb-2 pt-1`}>
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                scroll={false}
                prefetch
                onClick={() => hapticNav()}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                  active ? "bg-white/15 text-white border border-white/20" : "text-white/50 hover:text-white/80"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            )
          })}
        </nav>
      </header>
      <main className={`${ledgerMainWidth} pb-10 pt-6`}>{children}</main>
    </div>
  )
}
