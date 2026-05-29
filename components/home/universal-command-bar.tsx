"use client"

import Link from "next/link"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useWalletLanguage } from "@/lib/wallet-language"
import { formatWalletText } from "@/lib/wallet-texts"

type CommandItem = {
  id: string
  label: string
  href?: string
  comingSoon?: boolean
}

const commandButtonClass = cn(
  "flex h-12 flex-col items-center justify-center rounded-2xl border border-white/12 bg-white/[0.04]",
  "text-[9px] font-medium uppercase tracking-[0.16em] text-white/90",
  "transition-colors hover:bg-white/[0.08] active:scale-[0.97] active:bg-white/12",
)

function CommandButton({
  item,
  onPayClick,
  onDepositClick,
  comingSoonLabel,
  comingSoonDesc,
}: {
  item: CommandItem
  onPayClick?: () => void
  onDepositClick?: () => void
  comingSoonLabel: string
  comingSoonDesc: string
}) {
  if (item.comingSoon) {
    return (
      <button
        type="button"
        className={commandButtonClass}
        onClick={() =>
          toast(comingSoonLabel, {
            description: formatWalletText(comingSoonDesc, { label: item.label }),
          })
        }
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
      <button type="button" className={commandButtonClass} onClick={onDepositClick}>
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
  bare?: boolean
}) {
  const { t } = useWalletLanguage()

  const commands: CommandItem[] = [
    { id: "pay", label: t.cmdPay, href: "/wallet?send=1" },
    { id: "offramp", label: t.cmdOfframp, comingSoon: true },
    { id: "deposit", label: t.cmdDeposit },
    { id: "plan", label: t.cmdPlan, href: "/ledger/goals" },
    { id: "credit", label: t.cmdCredit, href: "/credit" },
  ]

  const grid = (
    <div className="grid grid-cols-3 gap-2">
      <CommandButton
        item={commands[0]}
        onPayClick={onPayClick}
        onDepositClick={
          onDepositClick ??
          (() =>
            toast(t.comingSoon, {
              description: formatWalletText(t.comingSoonDesc, { label: t.cmdDeposit }),
            }))
        }
        comingSoonLabel={t.comingSoon}
        comingSoonDesc={t.comingSoonDesc}
      />
      <div aria-hidden className="h-12" />
      <CommandButton
        item={commands[1]}
        onPayClick={onPayClick}
        onDepositClick={onDepositClick}
        comingSoonLabel={t.comingSoon}
        comingSoonDesc={t.comingSoonDesc}
      />
      {commands.slice(2).map((item) => (
        <CommandButton
          key={item.id}
          item={item}
          onPayClick={onPayClick}
          onDepositClick={
            onDepositClick ??
            (() =>
              toast(t.comingSoon, {
                description: formatWalletText(t.comingSoonDesc, { label: t.cmdDeposit }),
              }))
          }
          comingSoonLabel={t.comingSoon}
          comingSoonDesc={t.comingSoonDesc}
        />
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
        {t.commandTitle}
      </div>
      {grid}
    </div>
  )
}
