export type RampDirection = "on" | "off"

/**
 * DB order lifecycle (differs from Etherfuse's own):
 * on-ramp:  created → awaiting_payment → funded → settling → completed
 *           (funded  = Etherfuse saw fiat; settling = treasury→user forward in flight)
 * off-ramp: created → funded → settling → completed
 *           (funded  = user's C→treasury leg confirmed;
 *            settling = anchor memo payment sent, awaiting Etherfuse fiat leg)
 * failed / refunded are terminal and reachable from any non-terminal state.
 */
export type RampOrderDbStatus =
  | "created" | "awaiting_payment" | "funded" | "settling" | "completed" | "failed" | "refunded"

const FORWARD: Record<RampOrderDbStatus, RampOrderDbStatus[]> = {
  created: ["awaiting_payment", "funded", "failed", "refunded"],
  awaiting_payment: ["funded", "failed", "refunded"],
  funded: ["settling", "failed", "refunded"],
  settling: ["completed", "failed", "refunded"],
  completed: [],
  failed: [],
  refunded: [],
}

export function canTransition(from: RampOrderDbStatus, to: RampOrderDbStatus): boolean {
  return FORWARD[from]?.includes(to) ?? false
}

export interface RampCustomerRow {
  user_id: string
  provider: string
  customer_id: string
  kyc_email: string
  display_name: string
  bank_account_id: string | null
  wallet_id: string | null
  created_at: string
  updated_at: string
}

export interface RampOrderRow {
  id: string
  user_id: string
  provider: string
  direction: RampDirection
  status: RampOrderDbStatus
  fiat_currency: string
  fiat_amount_minor: number
  usdc_minor: number
  fx_rate: number
  fee_minor: number
  provider_order_id: string
  user_tx_hash: string | null
  settlement_tx_hash: string | null
  settlement_claimed_at: string | null
  destination_stellar_address: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}
