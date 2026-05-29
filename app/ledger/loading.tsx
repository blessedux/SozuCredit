import { LedgerHomeSkeleton } from "@/components/ledger/ledger-home-skeleton"

/** Instant fallback while /ledger home hydrates and fetches. */
export default function LedgerHomeLoading() {
  return <LedgerHomeSkeleton />
}
