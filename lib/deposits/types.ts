/** Deposit status lifecycle. */
export type DepositStatus =
  | "created"
  | "awaiting_payment"
  | "payment_received"
  | "pending_admin_review"
  | "approved"
  | "usdc_released"
  | "completed"
  | "failed"
  | "refunded"
  | "flagged";

export type DepositMethod = "bank_transfer" | "card";

/** Full row as returned from Supabase. */
export interface DepositIntent {
  id: string;
  user_id: string;
  method: DepositMethod;
  amount_clp: number;
  quoted_usdc_minor: number;
  fx_clp_per_usdc: number;
  status: DepositStatus;
  destination_stellar_address: string;
  bank_reference: string | null;
  sumup_checkout_id: string | null;
  sumup_transaction_id: string | null;
  stellar_tx_hash: string | null;
  approved_by: string | null;
  approved_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** Subset safe to return to the user. */
export interface DepositIntentPublic {
  id: string;
  method: DepositMethod;
  amount_clp: number;
  /** USDC amount as a human-readable string with 7 decimal places, e.g. "10.5000000" */
  usdc_amount: string;
  fx_clp_per_usdc: number;
  status: DepositStatus;
  bank_reference: string | null;
  stellar_tx_hash: string | null;
  created_at: string;
  updated_at: string;
}

/** Bank transfer instructions returned on deposit creation. */
export interface BankTransferInstructions {
  bank_name: string;
  account_number: string;
  rut: string;
  email: string;
  /** Unique code the user must include in the wire transfer description for matching. */
  reference: string;
  amount_clp: number;
  /** Informational: how much USDC they will receive. */
  usdc_amount: string;
}

/** Response body for POST /api/deposits (bank_transfer). */
export interface CreateBankDepositResponse {
  intent: DepositIntentPublic;
  instructions: BankTransferInstructions;
}

/** Response body for POST /api/deposits (card / SumUp). */
export interface CreateCardDepositResponse {
  intent: DepositIntentPublic;
  checkout_url: string;
  sumup_checkout_id: string;
}

/** Live FX quote for deposit UI. */
export interface DepositFxQuote {
  fx_clp_per_usdc: number;
  spot_clp_per_usdc: number;
  spread_bps: number;
  source: string;
  fetched_at: string;
  amount_clp?: number;
  quoted_usdc_minor?: number;
  usdc_amount?: string;
}

/** USDC minor units per 1 USDC (Stellar uses 7 decimal places). */
export const USDC_MINOR_SCALE = 10_000_000;
