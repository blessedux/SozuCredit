import { Skeleton } from "@/components/ui/skeleton"
import { LedgerTransactionsTableSkeleton } from "@/components/ledger/ledger-transactions-table-skeleton"

/** Matches /ledger/transactions toolbar + table while data loads. */
export function LedgerTransactionsRouteSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-4 w-28 rounded bg-white/10" />
            <Skeleton className="h-3 w-full max-w-md rounded bg-white/10" />
            <Skeleton className="h-3 w-full max-w-sm rounded bg-white/10" />
          </div>
          <Skeleton className="h-8 w-36 rounded bg-white/10" />
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-8 rounded bg-white/10" />
          <Skeleton className="h-4 w-28 rounded bg-white/10" />
          <Skeleton className="h-8 w-8 rounded bg-white/10" />
          <Skeleton className="h-8 w-16 rounded bg-white/10" />
          <Skeleton className="h-8 w-14 rounded bg-white/10" />
        </div>

        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Skeleton className="h-9 w-full max-w-md rounded-md bg-white/10" />
          <Skeleton className="h-9 w-28 rounded-md bg-white/10" />
        </div>

        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
          <div className="max-h-[min(70vh,520px)] overflow-hidden px-2 py-4 sm:px-3">
            <LedgerTransactionsTableSkeleton rows={10} />
          </div>
        </div>
      </div>
    </div>
  )
}
