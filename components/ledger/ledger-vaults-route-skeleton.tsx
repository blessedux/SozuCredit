import { Skeleton } from "@/components/ui/skeleton"

/** Matches /ledger/vaults header, metric cards, and vault grids. */
export function LedgerVaultsRouteSkeleton() {
  return (
    <div className="space-y-10">
      <header className="max-w-3xl space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-3 w-36 rounded bg-white/10" />
            <Skeleton className="h-8 w-44 rounded bg-white/10" />
          </div>
          <Skeleton className="h-10 w-40 rounded bg-white/10" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-full rounded bg-white/10" />
          <Skeleton className="h-3 w-5/6 max-w-2xl rounded bg-white/10" />
          <Skeleton className="h-3 w-2/3 max-w-xl rounded bg-white/10" />
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="min-h-[140px] rounded-2xl bg-emerald-500/10" />
        <Skeleton className="min-h-[140px] rounded-2xl bg-rose-500/10" />
        <Skeleton className="min-h-[140px] rounded-2xl bg-amber-500/10" />
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <Skeleton className="h-4 w-40 rounded bg-white/10" />
          <Skeleton className="h-3 w-16 rounded bg-white/10" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-56 rounded-2xl bg-white/10" />
          <Skeleton className="h-56 rounded-2xl bg-white/10" />
          <Skeleton className="h-56 rounded-2xl bg-white/10" />
        </div>
      </section>

      <section className="max-w-2xl space-y-3 rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.08] p-5 sm:p-6">
        <Skeleton className="h-3 w-44 rounded bg-cyan-500/20" />
        <Skeleton className="h-9 w-40 rounded bg-white/10" />
        <Skeleton className="h-3 w-full max-w-sm rounded bg-white/10" />
      </section>
    </div>
  )
}
