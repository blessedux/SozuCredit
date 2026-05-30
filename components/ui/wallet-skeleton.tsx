"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { motion } from "framer-motion"
import {
  BalanceCardSkeleton,
  CashflowLinkSkeleton,
  CashflowSummarySkeleton,
  CommandBarSkeleton,
  TransactionHistorySkeleton,
} from "@/components/wallet/wallet-skeleton-parts"
import { cn } from "@/lib/utils"

export type WalletSkeletonLayout = "landing" | "history" | "desktop"

interface WalletSkeletonProps {
  isExiting?: boolean
  layout?: WalletSkeletonLayout
}

export function WalletSkeleton({ isExiting = false, layout = "desktop" }: WalletSkeletonProps) {
  return (
    <motion.div
      className="relative h-full w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: isExiting ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      {layout === "landing" ? <WalletLandingSkeleton /> : null}
      {layout === "history" ? <WalletHistorySkeleton /> : null}
      {layout === "desktop" ? <WalletDesktopSkeleton /> : null}
    </motion.div>
  )
}

function WalletLandingSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex shrink-0 flex-col items-center gap-1.5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <Skeleton className="size-10 rounded-lg bg-white/10" />
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-4">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-start pt-2">
          <div className="flex min-h-0 w-full max-w-md flex-1 flex-col">
            <BalanceCardSkeleton compact />
          </div>
        </div>

        <div className="shrink-0 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-2">
          <CommandBarSkeleton />
        </div>
      </div>
    </div>
  )
}

function WalletHistorySkeleton() {
  return (
    <div className="relative z-10 h-full overflow-hidden px-4 pt-[max(3.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <CashflowLinkSkeleton />
        <CashflowSummarySkeleton />
        <TransactionHistorySkeleton rows={5} />
      </div>
    </div>
  )
}

function WalletDesktopSkeleton() {
  return (
    <div className="relative z-10 h-full overflow-hidden">
      <div className="relative mx-auto w-full max-w-7xl xl:max-w-[1320px] px-4 pt-16 pb-8 sm:px-6 md:py-12 lg:px-10 xl:px-12">
        <div className="mb-6 flex flex-col items-center gap-3 sm:mb-8 lg:items-center">
          <CashflowLinkSkeleton className="w-full lg:ml-auto lg:justify-end" />
        </div>

        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-12 lg:items-start lg:gap-8 xl:gap-10">
          <div className="min-w-0 lg:col-span-5 xl:col-span-4">
            <BalanceCardSkeleton />
          </div>
          <div className="min-w-0 lg:col-span-7 xl:col-span-8">
            <TransactionHistorySkeleton rows={6} />
          </div>
        </div>
      </div>
    </div>
  )
}

export function WalletLazySectionSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border border-white/20 bg-white/5 p-4", className)}>
      <TransactionHistorySkeleton rows={3} className="border-0 bg-transparent p-0" />
    </div>
  )
}
