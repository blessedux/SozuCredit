import { Skeleton } from "@/components/ui/skeleton"
import { LedgerTransactionsTableSkeleton } from "@/components/ledger/ledger-transactions-table-skeleton"

/** Matches /ledger home grid so route transitions and first fetch feel stable. */
export function LedgerHomeSkeleton() {
  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        <div className="flex min-w-0 flex-col gap-4">
          <section className="space-y-3 rounded-xl border border-white/15 bg-white/[0.03] p-5">
            <Skeleton className="h-3 w-40 rounded bg-white/10" />
            <Skeleton className="h-9 w-44 rounded bg-white/10" />
            <Skeleton className="h-3 w-full max-w-sm rounded bg-white/10" />
          </section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="space-y-3 rounded-xl border border-orange-500/20 bg-orange-500/[0.04] p-5">
              <Skeleton className="h-3 w-36 rounded bg-orange-500/20" />
              <Skeleton className="h-9 w-40 rounded bg-orange-500/20" />
              <Skeleton className="h-16 w-full rounded bg-white/10" />
            </section>
            <section className="space-y-3 rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-5">
              <Skeleton className="h-3 w-28 rounded bg-sky-500/20" />
              <Skeleton className="h-9 w-32 rounded bg-sky-500/20" />
              <Skeleton className="h-12 w-full rounded bg-white/10" />
            </section>
          </div>

          <section className="space-y-3 rounded-xl border border-white/15 bg-white/[0.03] p-5">
            <Skeleton className="h-3 w-44 rounded bg-white/10" />
            <Skeleton className="h-4 w-full rounded bg-white/10" />
            <div className="space-y-3 pt-1">
              <Skeleton className="h-5 w-full rounded bg-white/10" />
              <Skeleton className="h-5 w-full rounded bg-white/10" />
              <Skeleton className="h-6 w-full rounded bg-white/10" />
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-white/15 bg-white/[0.03] p-5">
            <Skeleton className="h-3 w-48 rounded bg-white/10" />
            <Skeleton className="h-4 w-full rounded bg-white/10" />
            <div className="space-y-2 pt-1">
              <Skeleton className="h-5 w-full rounded bg-white/10" />
              <Skeleton className="h-5 w-full rounded bg-white/10" />
              <Skeleton className="h-6 w-full rounded bg-white/10" />
            </div>
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <section className="space-y-3 rounded-xl border border-white/15 bg-white/[0.03] p-5">
            <Skeleton className="h-3 w-36 rounded bg-amber-500/20" />
            <Skeleton className="h-4 w-full rounded bg-white/10" />
            <Skeleton className="h-4 w-5/6 max-w-md rounded bg-white/10" />
            <div className="space-y-2 border-t border-white/10 pt-4">
              <Skeleton className="h-4 w-full rounded bg-white/10" />
              <Skeleton className="h-4 w-4/5 rounded bg-white/10" />
            </div>
          </section>

          <section className="space-y-4 rounded-xl border border-white/15 bg-white/[0.03] p-5">
            <Skeleton className="h-3 w-44 rounded bg-white/10" />
            <Skeleton className="h-4 w-full rounded bg-white/10" />
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-white/10 p-1">
              <Skeleton className="h-8 rounded-md bg-white/10" />
              <Skeleton className="h-8 rounded-md bg-white/10" />
            </div>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-white/10 p-1">
              <Skeleton className="h-8 rounded-md bg-white/10" />
              <Skeleton className="h-8 rounded-md bg-white/10" />
              <Skeleton className="h-8 rounded-md bg-white/10" />
            </div>
            <Skeleton className="mx-auto h-[220px] w-full max-w-[280px] rounded-full bg-white/10 lg:mx-0" />
          </section>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-white/15 bg-white/[0.03]">
        <div className="flex justify-between gap-2 border-b border-white/10 px-4 py-4 sm:px-5">
          <Skeleton className="h-4 w-40 rounded bg-white/10" />
          <Skeleton className="h-8 w-28 rounded bg-white/10" />
        </div>
        <div className="max-h-[min(52vh,560px)] overflow-hidden px-2 py-4 sm:px-3">
          <LedgerTransactionsTableSkeleton rows={8} />
        </div>
      </section>
    </div>
  )
}
