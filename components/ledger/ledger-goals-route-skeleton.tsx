import { Skeleton } from "@/components/ui/skeleton"

/** Matches /ledger/goals header, summary strip, and form sections. */
export function LedgerGoalsRouteSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-3 w-36 rounded bg-white/10" />
          <Skeleton className="h-7 w-56 rounded bg-white/10" />
          <Skeleton className="h-3 w-full max-w-xl rounded bg-white/10" />
          <Skeleton className="h-3 w-full max-w-md rounded bg-white/10" />
        </div>
        <Skeleton className="h-8 w-36 rounded bg-white/10" />
      </div>

      <div className="space-y-2 rounded-xl border border-white/15 bg-white/[0.03] px-4 py-4">
        <Skeleton className="h-3 w-48 rounded bg-white/10" />
        <Skeleton className="h-4 w-full max-w-xl rounded bg-white/10" />
      </div>

      <div className="space-y-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3">
        <Skeleton className="h-3 w-40 rounded bg-emerald-500/20" />
        <Skeleton className="h-4 w-full max-w-2xl rounded bg-white/10" />
      </div>

      <div className="max-w-3xl space-y-6">
        <section className="space-y-4 rounded-xl border border-white/15 bg-white/[0.03] p-5">
          <Skeleton className="h-3 w-24 rounded bg-white/10" />
          <Skeleton className="h-10 w-full max-w-md rounded bg-white/10" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-10 rounded bg-white/10" />
            <Skeleton className="h-10 rounded bg-white/10" />
            <Skeleton className="h-10 rounded bg-white/10 sm:col-span-2" />
            <Skeleton className="h-10 rounded bg-white/10" />
            <Skeleton className="h-10 rounded bg-white/10" />
          </div>
          <Skeleton className="h-24 w-full rounded bg-white/10" />
          <Skeleton className="h-10 w-32 rounded bg-white/10" />
        </section>

        <section className="space-y-3 rounded-xl border border-white/15 bg-white/[0.03] p-5">
          <Skeleton className="h-3 w-32 rounded bg-white/10" />
          <Skeleton className="h-20 w-full rounded bg-white/10" />
          <Skeleton className="h-20 w-full rounded bg-white/10" />
        </section>
      </div>
    </div>
  )
}
