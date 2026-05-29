import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export function BalanceCardSkeleton({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div
      className={cn(
        "w-full rounded-[1.25rem] border border-white/10 bg-black/20 text-center shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md",
        compact ? "p-5 sm:p-6" : "min-h-[11rem] p-6 sm:min-h-[12rem] sm:p-8 lg:min-h-[13.5rem] lg:p-7 lg:text-left",
        className,
      )}
    >
      <Skeleton className="mx-auto h-3 w-28 rounded bg-white/10 lg:mx-0" />
      <Skeleton className="mx-auto mt-5 h-12 w-44 max-w-full rounded bg-white/10 sm:h-14 sm:w-52 lg:mx-0" />
      <Skeleton className="mx-auto mt-3 h-3 w-24 rounded bg-white/10 lg:mx-0" />
      <div className="mt-4 flex justify-center lg:justify-start">
        <Skeleton className="h-7 w-24 rounded-full bg-white/10" />
      </div>
    </div>
  )
}

export function CommandBarSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[17rem] rounded-[2rem] border border-white/10 bg-black/20 p-3 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md",
        className,
      )}
    >
      <Skeleton className="mx-auto mb-3 h-2 w-16 rounded bg-white/10" />
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-11 rounded-xl bg-white/10" />
        <Skeleton className="h-11 rounded-xl bg-white/10" />
        <Skeleton className="h-11 rounded-xl bg-white/10" />
      </div>
    </div>
  )
}

export function CashflowLinkSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex justify-end", className)}>
      <Skeleton className="h-9 w-32 rounded-full bg-white/10" />
    </div>
  )
}

export function CashflowSummarySkeleton({ className }: { className?: string }) {
  return (
    <section
      className={cn(
        "rounded-xl border border-white/10 bg-black/20 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.25)] backdrop-blur-md",
        className,
      )}
    >
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <Skeleton className="h-2.5 w-28 rounded bg-white/10" />
        <Skeleton className="h-2.5 w-16 rounded bg-white/10" />
      </div>
      <div className="grid min-h-[11.5rem] grid-cols-2 gap-x-3 gap-y-5 sm:gap-x-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <Skeleton className="size-[4.5rem] rounded-full bg-white/10 sm:size-20" />
            <Skeleton className="h-2.5 w-14 rounded bg-white/10" />
            <Skeleton className="h-2 w-10 rounded bg-white/10" />
          </div>
        ))}
      </div>
    </section>
  )
}

export function TransactionHistorySkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-white/20 bg-white/5 p-4 sm:p-5 lg:p-6", className)}>
      <ul className="space-y-2 sm:space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 rounded-lg bg-white/5 p-3 sm:gap-4 sm:p-4">
            <Skeleton className="size-5 shrink-0 rounded bg-white/10 sm:size-6" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-24 rounded bg-white/10 sm:h-6 sm:w-28" />
              <Skeleton className="h-3 w-full max-w-[12rem] rounded bg-white/10" />
            </div>
            <Skeleton className="hidden h-3 w-16 rounded bg-white/10 md:block" />
          </li>
        ))}
      </ul>
    </div>
  )
}
