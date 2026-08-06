import "server-only"

import { decimalToUsdcMinor } from "@/lib/ramp/decimal"
import {
  claimOrderForSettlement,
  claimSettlingRetry,
  setRampOrderSettlementTx,
  transitionRampOrder,
} from "@/lib/db/ramp"
import { sendAnchorPayment, sendRampUsdcToUser } from "@/lib/ramp/settlement"
import type { RampProvider, RampOrderStatus } from "@/lib/ramp/provider"
import type { RampDirection, RampOrderDbStatus, RampOrderRow } from "@/lib/ramp/types"

/**
 * Settlement lease for the settling+null-hash retry path. Must exceed the
 * ~45s Soroban confirmation window `sendRampUsdcToUser` can block for, so
 * a still-in-flight send is never re-claimed out from under itself; matching
 * it to the cron period means a claimant that crashed mid-send is retryable
 * by the very next sweep, not stuck for longer than necessary.
 */
const SETTLEMENT_LEASE_MS = 5 * 60_000

/**
 * Maps a fresh provider status onto a DB row's current status.
 * Returns the target DB status, or null when no transition applies.
 * Pure — the I/O (claiming, forwarding, writing) lives in reconcileOrder.
 */
export function mapProviderStatus(
  direction: RampDirection,
  dbStatus: RampOrderDbStatus,
  providerStatus: RampOrderStatus,
): RampOrderDbStatus | null {
  const terminal = dbStatus === "completed" || dbStatus === "failed" || dbStatus === "refunded"
  if (terminal) return null
  if (providerStatus === "refunded" || providerStatus === "canceled") return "refunded"
  if (providerStatus === "failed") return "failed"

  if (direction === "on") {
    // Etherfuse funded/completed both mean "fiat arrived, USDC hits treasury";
    // our own funded→settling→completed leg (the forward) is driven by
    // reconcileOrder, not by this mapping.
    if ((providerStatus === "funded" || providerStatus === "completed" || providerStatus === "finalized")
        && (dbStatus === "created" || dbStatus === "awaiting_payment")) {
      return "funded"
    }
    return null
  }
  // off-ramp: our settling = anchor payment sent; Etherfuse funded/completed
  // = they saw it (fiat settles async — that's still "completed" for us).
  if (dbStatus === "settling"
      && (providerStatus === "funded" || providerStatus === "completed" || providerStatus === "finalized")) {
    return "completed"
  }
  return null
}

/**
 * Sync one order against the provider and run any due settlement step.
 * Idempotent and concurrency-safe: every write goes through guarded
 * transitions, and the per-user-G forward only happens on the row that WON
 * the funded→settling claim (or, for a retry, the settlement lease via
 * `claimSettlingRetry`).
 */
export async function reconcileOrder(order: RampOrderRow, provider: RampProvider): Promise<RampOrderRow> {
  let current = order
  const state = await provider.getOrder(current.provider_order_id)
  const next = mapProviderStatus(current.direction, current.status, state.status)
  if (next) {
    const moved = await transitionRampOrder(current.id, [current.status], next)
    if (moved) current = moved
  }

  // On-ramp settlement: forward per-user G → user C once Etherfuse reports
  // the USDC delivered. amountInTokens only exists at provider status
  // 'completed'; until then, stay 'funded' and let the next poll retry.
  if (current.direction === "on" && current.status === "funded" && state.amountTokens) {
    const claimed = await claimOrderForSettlement(current.id)
    if (claimed) {
      current = claimed
      const amountMinor = decimalToUsdcMinor(state.amountTokens, "floor")
      try {
        const { txHash } = await sendRampUsdcToUser({
          userId: current.user_id,
          toAddress: current.destination_stellar_address!,
          amountMinor,
        })
        const done = await transitionRampOrder(current.id, ["settling"], "completed", {
          settlement_tx_hash: txHash,
          usdc_minor: amountMinor,
        })
        if (done) current = done
      } catch (e) {
        // Leave the row in 'settling' — funds are safe in treasury. The
        // block below retries it, but only after re-claiming the lease
        // `claimOrderForSettlement` just stamped, so this same pass can't
        // immediately double-send (see `claimSettlingRetry`'s comment).
        console.error("[ramp/reconcile] forward failed, will retry:", current.id, e)
      }
    }
  }

  // Retry a previously-failed forward: settling with no settlement_tx_hash.
  // Structural double-send guard — NOT "the window is sub-second so it's
  // fine": `sendRampUsdcToUser` can block up to ~45s on Soroban
  // confirmation, and this same row is reachable from both the cron sweep
  // and a user's GET landing concurrently. `claimSettlingRetry` re-stamps
  // `settlement_claimed_at` under a guarded UPDATE that only succeeds when
  // the row is unclaimed or the previous claimant's lease is stale
  // (`SETTLEMENT_LEASE_MS`); only the caller that wins the claim sends.
  if (current.direction === "on" && current.status === "settling" && !current.settlement_tx_hash && state.amountTokens) {
    const claimed = await claimSettlingRetry(current.id, SETTLEMENT_LEASE_MS)
    if (claimed) {
      current = claimed
      const amountMinor = decimalToUsdcMinor(state.amountTokens, "floor")
      try {
        const { txHash } = await sendRampUsdcToUser({
          userId: current.user_id,
          toAddress: current.destination_stellar_address!,
          amountMinor,
        })
        const done = await transitionRampOrder(current.id, ["settling"], "completed", {
          settlement_tx_hash: txHash,
          usdc_minor: amountMinor,
        })
        if (done) current = done
      } catch (e) {
        console.error("[ramp/reconcile] forward retry failed:", current.id, e)
      }
    }
  }

  // Off-ramp retry: the user's C→per-user-G leg is confirmed (user_tx_hash
  // set) but the per-user-G→anchor memo payment hasn't landed yet (previous
  // sendAnchorPayment crashed/failed, or the submit route never got that
  // far — either way the funds are safe on the per-user G). Mirrors the
  // submit route's settle step: same claimSettlingRetry lease guards against
  // double-send, and the amount always comes from order.usdc_minor — never
  // re-derived from provider state, since off-ramp settlement doesn't wait
  // on anything Etherfuse reports.
  if (
    current.direction === "off"
    && current.status === "settling"
    && !current.settlement_tx_hash
    && current.user_tx_hash
  ) {
    const claimed = await claimSettlingRetry(current.id, SETTLEMENT_LEASE_MS)
    if (claimed) {
      current = claimed
      const meta = current.metadata as { withdrawAnchorAccount?: string; withdrawMemoBase64?: string }
      if (!meta.withdrawAnchorAccount || !meta.withdrawMemoBase64) {
        console.error("[ramp/reconcile] off-ramp settling retry missing anchor metadata:", current.id)
      } else {
        try {
          const { txHash } = await sendAnchorPayment({
            userId: current.user_id,
            anchorAccount: meta.withdrawAnchorAccount,
            memoBase64: meta.withdrawMemoBase64,
            amountUsdcMinor: current.usdc_minor,
          })
          await setRampOrderSettlementTx(current.id, txHash)
          current = { ...current, settlement_tx_hash: txHash }
        } catch (e) {
          console.error("[ramp/reconcile] anchor payment retry failed:", current.id, e)
        }
      }
    }
  }

  return current
}
