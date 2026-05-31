/**
 * Balance display component
 * Shows reference-fiat balance (from settings) as the primary figure,
 * USDC as a small gray subline, plus APY / purchasing power badge.
 */

"use client"

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { ChevronLeft, TrendingUp } from "lucide-react"
import { SlidingNumber } from "@/components/ui/sliding-number"
import { BalanceAuditPanel } from "@/components/wallet/balance-audit-panel"
import { formatBalance, maskBalance } from "@/lib/wallet-utils"
import { formatReferenceAmount } from "@/lib/ledger/format-fiat"
import { getFxSpotRate } from "@/lib/treasury/mock-rates"
import {
  hasComputedTreasuryProjection,
  treasuryPeriodDisplayPct,
  treasuryYieldDisplayApy,
} from "@/lib/treasury/projection-display"
import type { DefindexBalance } from "@/hooks/use-wallet-data"
import type { TreasuryProjection, TreasuryPrefs, ReferenceFiat } from "@/lib/treasury/types"
import { cn } from "@/lib/utils"
import { useWalletLanguage } from "@/lib/wallet-language"
import { formatWalletText } from "@/lib/wallet-texts"

const PurchasingPowerPnlChart = dynamic(
  () =>
    import("@/components/wallet/purchasing-power-pnl-chart").then((mod) => ({
      default: mod.PurchasingPowerPnlChart,
    })),
  {
    ssr: false,
    loading: () => <div className="h-[4.5rem] w-[5.75rem] shrink-0 animate-pulse rounded-xl border border-white/10 bg-white/[0.03]" />,
  },
)

function referenceDisplayValue(balanceUsdc: number, referenceFiat: ReferenceFiat): number {
  const local = balanceUsdc * getFxSpotRate(referenceFiat)
  return referenceFiat === "CLP" || referenceFiat === "ARS" ? Math.round(local) : local
}

interface BalanceDisplayProps {
  animatedBalance: number
  isBalanceVisible: boolean
  apyValue: number | null
  apyLoading: boolean
  defindexBalanceApy: number | null
  onToggleVisibility: () => void
  onOpenBalanceAudit?: () => void
  onFetchAPY?: () => void
  treasuryProjection: TreasuryProjection | null
  treasuryLoading: boolean
  referenceFiat: ReferenceFiat
  /** Landing: expand treasury inline on the card instead of opening a modal. */
  inlineAudit?: boolean
  defindexBalance?: DefindexBalance | null
  treasuryPrefs?: TreasuryPrefs
  onUpdateTreasuryPrefs?: (next: Partial<TreasuryPrefs>) => void
  onAuditExpandedChange?: (expanded: boolean) => void
  walletNetwork?: "testnet" | "mainnet"
  /** Called after a successful earn deposit/withdraw to refresh balances. */
  onRefresh?: () => void
}

export const BalanceDisplay = memo(function BalanceDisplay({
  animatedBalance,
  isBalanceVisible,
  apyValue,
  apyLoading,
  defindexBalanceApy,
  onToggleVisibility,
  onOpenBalanceAudit,
  onFetchAPY,
  treasuryProjection,
  treasuryLoading,
  referenceFiat,
  inlineAudit = false,
  defindexBalance = null,
  treasuryPrefs,
  onUpdateTreasuryPrefs,
  onAuditExpandedChange,
  walletNetwork = "testnet",
  onRefresh,
}: BalanceDisplayProps) {
  const { t } = useWalletLanguage()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const collapsedHeightRef = useRef(168)
  const [auditExpanded, setAuditExpanded] = useState(false)
  const [expandedHeight, setExpandedHeight] = useState(0)

  const measureCollapsedHeight = useCallback(() => {
    const card = cardRef.current
    if (!card) return
    collapsedHeightRef.current = card.getBoundingClientRect().height
  }, [])

  const measureExpandedHeight = useCallback(() => {
    const parent = wrapperRef.current?.parentElement
    if (!parent) return
    const next = parent.clientHeight
    const fallback = Math.round(
      window.innerHeight -
        (typeof window !== "undefined"
          ? parseFloat(getComputedStyle(document.documentElement).fontSize) * 14
          : 220),
    )
    setExpandedHeight(next > 0 ? next : Math.max(280, fallback))
  }, [])

  const setExpanded = useCallback(
    (next: boolean) => {
      setAuditExpanded(next)
      onAuditExpandedChange?.(next)
    },
    [onAuditExpandedChange],
  )

  useEffect(() => {
    if (!inlineAudit || !auditExpanded) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (cardRef.current && !cardRef.current.contains(target)) {
        setExpanded(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [auditExpanded, inlineAudit, setExpanded])

  const usdcBalance = formatBalance(animatedBalance)
  const maskedUsdc = maskBalance(usdcBalance)
  const referenceValue = referenceDisplayValue(animatedBalance, referenceFiat)
  const referenceFormatted = formatReferenceAmount(referenceValue, referenceFiat)
  const maskedReference = maskBalance(referenceFormatted)

  const protocolApy = apyLoading
    ? null
    : typeof apyValue === "number" && !isNaN(apyValue) && apyValue > 0
      ? apyValue
      : typeof defindexBalanceApy === "number" && !isNaN(defindexBalanceApy) && defindexBalanceApy > 0
        ? defindexBalanceApy
        : 15.5

  const yieldApy = treasuryYieldDisplayApy(treasuryProjection, protocolApy)
  const periodPowerPct = treasuryPeriodDisplayPct(treasuryProjection)
  const hasTreasury = hasComputedTreasuryProjection(treasuryProjection)

  const primaryBadge = treasuryLoading
    ? "..."
    : yieldApy !== null
      ? `${yieldApy.toFixed(2)}%`
      : "..."

  const sublineBadge = treasuryLoading
    ? null
    : hasTreasury && periodPowerPct !== null && treasuryPrefs
      ? formatWalletText(t.purchasingPowerSubline, {
          pct: periodPowerPct.toFixed(1),
          days: treasuryPrefs.holdingDays,
        })
      : yieldApy !== null
        ? t.apyBlendLabel
        : null

  useLayoutEffect(() => {
    if (!inlineAudit || auditExpanded) return
    measureCollapsedHeight()
  }, [
    inlineAudit,
    animatedBalance,
    isBalanceVisible,
    referenceFiat,
    treasuryLoading,
    primaryBadge,
    sublineBadge,
    hasTreasury,
    measureCollapsedHeight,
  ])

  useLayoutEffect(() => {
    if (!inlineAudit || !auditExpanded) return

    measureExpandedHeight()
    const parent = wrapperRef.current?.parentElement
    if (!parent) return

    const observer = new ResizeObserver(() => measureExpandedHeight())
    observer.observe(parent)
    return () => observer.disconnect()
  }, [auditExpanded, inlineAudit, measureExpandedHeight])

  const balanceSizeClass =
    "max-w-full overflow-hidden text-[clamp(1.875rem,8vw,3rem)] font-bold leading-none tracking-tight tabular-nums text-white sm:text-5xl lg:text-[clamp(1.75rem,2.8vw,2.5rem)] xl:text-[clamp(1.875rem,2.5vw,2.75rem)]"

  const handleAuditToggle = useCallback(() => {
    if (apyLoading && onFetchAPY) onFetchAPY()
    if (inlineAudit && treasuryPrefs && onUpdateTreasuryPrefs) {
      if (!auditExpanded) {
        measureCollapsedHeight()
        measureExpandedHeight()
      }
      setExpanded(!auditExpanded)
      return
    }
    onOpenBalanceAudit?.()
  }, [
    apyLoading,
    auditExpanded,
    inlineAudit,
    measureCollapsedHeight,
    measureExpandedHeight,
    onFetchAPY,
    onOpenBalanceAudit,
    onUpdateTreasuryPrefs,
    setExpanded,
    treasuryPrefs,
  ])

  const canInlineExpand = inlineAudit && treasuryPrefs && onUpdateTreasuryPrefs
  const inlineCardMaxHeight = auditExpanded
    ? Math.max(expandedHeight, collapsedHeightRef.current)
    : collapsedHeightRef.current

  const handleCardTransitionEnd = useCallback(
    (event: React.TransitionEvent<HTMLDivElement>) => {
      if (event.propertyName !== "max-height" || auditExpanded) return
      measureCollapsedHeight()
    },
    [auditExpanded, measureCollapsedHeight],
  )

  const stopPullPropagation = useCallback((event: { stopPropagation: () => void }) => {
    event.stopPropagation()
  }, [])

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "relative w-full",
        inlineAudit && "flex min-h-0 flex-1 flex-col",
        !inlineAudit && "mb-8 lg:mb-0",
      )}
    >
      <div
        ref={cardRef}
        style={inlineAudit ? { maxHeight: inlineCardMaxHeight } : undefined}
        onTransitionEnd={inlineAudit ? handleCardTransitionEnd : undefined}
        className={cn(
          "flex w-full flex-col rounded-[1.25rem] border border-white/10 bg-black/20 text-center shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md",
          inlineAudit &&
            "min-h-0 self-start transition-[max-height] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] will-change-[max-height]",
          inlineAudit && !auditExpanded && "overflow-hidden",
          inlineAudit && auditExpanded && "flex min-h-0 flex-1 flex-col self-stretch overflow-hidden",
          inlineAudit ? "p-5 sm:p-6" : "min-h-[11rem] p-6 sm:min-h-[12rem] sm:p-8 lg:min-h-[13.5rem] lg:p-7 lg:text-left xl:min-h-[14rem] xl:p-8",
        )}
      >
        <div
          className={cn(
            "flex min-w-0 shrink-0 select-none gap-3",
            !auditExpanded && "cursor-pointer",
            auditExpanded ? "flex-col items-center lg:items-start" : "flex-row items-center justify-between",
          )}
          onClick={auditExpanded ? undefined : onToggleVisibility}
          onKeyDown={
            auditExpanded
              ? undefined
              : (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    onToggleVisibility()
                  }
                }
          }
          role={auditExpanded ? undefined : "button"}
          tabIndex={auditExpanded ? undefined : 0}
          aria-label={auditExpanded ? undefined : isBalanceVisible ? t.hideBalance : t.showBalance}
        >
          <div className={cn("min-w-0 flex-1", auditExpanded ? "w-full" : "text-left")}>
            <div
              className={cn(
                "flex max-w-full items-baseline gap-1.5",
                auditExpanded ? "justify-center lg:justify-start" : "justify-start",
              )}
            >
              <div className={balanceSizeClass}>
                {isBalanceVisible ? (
                  <SlidingNumber
                    value={referenceValue}
                    groupThousands={referenceFiat === "CLP" || referenceFiat === "ARS"}
                  />
                ) : (
                  <span className="tabular-nums">{maskedReference}</span>
                )}
              </div>
              <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-white/40">
                {referenceFiat}
              </span>
            </div>

            <p
              className={cn(
                "mt-1.5 text-xs tabular-nums text-white/35 sm:text-sm",
                auditExpanded && "text-center lg:text-left",
              )}
            >
              {isBalanceVisible ? `${usdcBalance} USDC` : `${maskedUsdc} USDC`}
            </p>
          </div>

          {!auditExpanded && hasTreasury ? (
            <div className="shrink-0 transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]">
              <PurchasingPowerPnlChart
                projection={treasuryProjection}
                loading={treasuryLoading}
                variant="mini"
                className="self-center"
              />
            </div>
          ) : null}
        </div>

        <div
          className={cn(
            "shrink-0 border-t border-white/15",
            inlineAudit ? "mt-4 pt-4" : auditExpanded ? "mt-3 pt-3" : "mt-auto pt-4 lg:pt-5",
          )}
        >
          <button
            type="button"
            onClick={handleAuditToggle}
            className={cn(
              "inline-flex min-h-[36px] w-full items-center justify-center gap-2 rounded-lg px-2 py-1.5 text-green-400 transition-colors hover:bg-white/5 hover:text-green-300 lg:min-h-[40px] lg:justify-start lg:px-1",
              auditExpanded && "justify-start",
            )}
            aria-label={auditExpanded ? t.closeTreasury : t.auditBreakdown}
            aria-expanded={canInlineExpand ? auditExpanded : undefined}
          >
            {auditExpanded ? (
              <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <TrendingUp className="h-4 w-4 shrink-0" aria-hidden />
            )}
            <span className="text-sm font-semibold tabular-nums">{primaryBadge}</span>
            {!auditExpanded && sublineBadge ? (
              <span
                className={cn(
                  "text-[10px] text-white/45 transition-opacity duration-300",
                  auditExpanded ? "opacity-0" : "opacity-100",
                )}
              >
                {sublineBadge}
              </span>
            ) : null}
            <span className="text-[10px] leading-snug text-white/45 lg:ml-auto">
              {auditExpanded
                ? t.backToBalance
                : hasTreasury
                  ? t.auditBreakdown
                  : t.balanceAudit}
            </span>
          </button>
        </div>

        {canInlineExpand && auditExpanded ? (
          <div
            className="mt-3 flex min-h-0 flex-1 flex-col border-t border-white/10 pt-3 text-left"
            onTouchStart={stopPullPropagation}
            onTouchMove={stopPullPropagation}
            onMouseDown={stopPullPropagation}
          >
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain touch-pan-y no-scrollbar [-webkit-overflow-scrolling:touch]">
              <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <PurchasingPowerPnlChart
                  projection={treasuryProjection}
                  loading={treasuryLoading}
                  variant="full"
                />
              </div>
              <BalanceAuditPanel
                defindexBalance={defindexBalance}
                apyValue={apyValue}
                apyLoading={apyLoading}
                treasuryProjection={treasuryProjection}
                treasuryLoading={treasuryLoading}
                treasuryPrefs={treasuryPrefs}
                onUpdateTreasuryPrefs={onUpdateTreasuryPrefs}
                onClose={() => setExpanded(false)}
                showHeader
                hideChart
                walletNetwork={walletNetwork}
                onRefresh={onRefresh}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
})
