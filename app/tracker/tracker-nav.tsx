"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, ScanLine, BarChart3, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

const tabs = [
  { href: "/tracker", label: "Home", icon: Home },
  { href: "/tracker/scan", label: "Scan", icon: ScanLine },
  { href: "/tracker/reports", label: "Reports", icon: BarChart3 },
  { href: "/tracker/settings", label: "Settings", icon: Settings },
] as const

export function TrackerNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-around py-2">
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== "/tracker" && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg px-4 py-2 transition-colors",
                isActive ? "text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="size-5" />
              <span className="text-xs">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
