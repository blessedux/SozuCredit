"use client"

import Link from "next/link"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type CommandItem = {
  id: string
  label: string
  href?: string
  comingSoon?: boolean
}

const COMMANDS: CommandItem[] = [
  { id: "pay", label: "Pay", href: "/wallet?send=1" },
  { id: "batch", label: "Batch", comingSoon: true },
  { id: "offramp", label: "Offramp", comingSoon: true },
  { id: "deposit", label: "Deposit" },
  { id: "plan", label: "Plan", href: "/ledger/goals" },
  { id: "credit", label: "Credit", href: "/ledger" },
]

const commandButtonClass = cn(
  "flex h-12 flex-col items-center justify-center rounded-2xl border border-white/12 bg-white/[0.04]",
  "text-[9px] font-medium uppercase tracking-[0.16em] text-white/90",
  "transition-colors hover:bg-white/[0.08] active:scale-[0.97] active:bg-white/12",
)

function CommandButton({
  item,
  onPayClick,
  onDepositClick,
}: {
  item: CommandItem
  onPayClick?: () => void
  onDepositClick?: () => void
}) {
  if (item.comingSoon) {
    return (
      <button
        type="button"
        className={commandButtonClass}
        onClick={() => toast("Coming soon", { description: `${item.label} is not available yet.` })}
      >
        {item.label}
      </button>
    )
  }

  if (item.id === "pay" && onPayClick) {
    return (
      <button type="button" className={commandButtonClass} onClick={onPayClick}>
        {item.label}
      </button>
    )
  }

  if (item.id === "deposit") {
    return (
      <button
        type="button"
        className={commandButtonClass}
        onClick={onDepositClick ?? (() => toast("Coming soon", { description: "Deposit is not available yet." }))}
      >
        {item.label}
      </button>
    )
  }

  return (
    <Link href={item.href!} className={commandButtonClass}>
      {item.label}
    </Link>
  )
}

export function UniversalCommandBar({
  className,
  onPayClick,
  onDepositClick,
  bare = false,
}: {
  className?: string
  onPayClick?: () => void
  onDepositClick?: () => void
  /** When true, renders just the button grid without the card wrapper */
  bare?: boolean
}) {
  const grid = (
    <div className="grid grid-cols-3 gap-2">
      {COMMANDS.map((item) => (
        <CommandButton key={item.id} item={item} onPayClick={onPayClick} onDepositClick={onDepositClick} />
      ))}
    </div>
  )

  if (bare) return <div className={cn("w-full", className)}>{grid}</div>

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[17rem] rounded-[2rem] border border-white/10 bg-black/20 p-3 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md",
        className,
      )}
    >
      <div className="mb-2 text-center text-[8px] font-light uppercase tracking-[0.28em] text-white/40">
        Command
      </div>
      {grid}
    </div>
  )
}
