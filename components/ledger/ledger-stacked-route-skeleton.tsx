import { Skeleton } from "@/components/ui/skeleton"

/** Matches /ledger home grid so route transitions and first fetch feel stable. */
export function LedgerStackedRouteSkeleton() {
  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <section className="rounded-xl border border-white/15 bg-white/[0.03] p-5 space-y-3">
          <Skeleton className="h-3 w-40 rounded bg-white/10" />
          <Skeleton className="h-9 w-48 rounded bg-white/10" />
          <Skeleton className="h-3 w-full max-w-sm rounded bg-white/10" />
        </section>
        <section className="rounded-xl border border-white/15 bg-white/[0.03] p-5 space-y-3">
          <Skeleton className="h-3 w-36 rounded bg-white/10" />
          <Skeleton className="h-16 w-full rounded bg-white/10" />
        </section>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <section className="rounded-xl border border-white/15 bg-white/[0.03] p-5 space-y-4">
          <Skeleton className="h-3 w-44 rounded bg-white/10" />
          <Skeleton className="h-4 w-full rounded bg-white/10" />
          <div className="space-y-3 pt-2">
            <Skeleton className="h-5 w-full rounded bg-white/10" />
            <Skeleton className="h-5 w-full rounded bg-white/10" />
            <Skeleton className="h-6 w-full rounded bg-white/10" />
          </div>
        </section>
        <section className="rounded-xl border border-white/15 bg-white/[0.03] p-5 space-y-4">
          <Skeleton className="h-3 w-48 rounded bg-white/10" />
          <div className="flex gap-1">
            <Skeleton className="h-9 flex-1 rounded-lg bg-white/10" />
            <Skeleton className="h-9 flex-1 rounded-lg bg-white/10" />
          </div>
          <Skeleton className="h-[240px] w-full max-w-[280px] mx-auto rounded-full bg-white/10 lg:mx-0" />
        </section>
      </div>
      <section className="rounded-xl border border-white/15 bg-white/[0.03] overflow-hidden">
        <div className="border-b border-white/10 px-4 py-4 sm:px-5 flex justify-between gap-2">
          <Skeleton className="h-4 w-40 rounded bg-white/10" />
          <Skeleton className="h-8 w-28 rounded bg-white/10" />
        </div>
        <div className="px-3 py-4 sm:px-5 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded bg-white/10" />
          ))}
        </div>
      </section>
    </div>
  )
}
