import { LedgerStackedRouteSkeleton } from "@/components/ledger/ledger-stacked-route-skeleton"

/** Instant fallback while a /ledger/* client page hydrates and fetches. */
export default function LedgerSegmentLoading() {
  return <LedgerStackedRouteSkeleton />
}
