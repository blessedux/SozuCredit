/** Shared types for the Sozu Faucet feature (DB rows, API shapes). */

export type FaucetStatus = "active" | "inactive";
export type FaucetClaimStatus = "pending" | "success" | "failed";

/** Row in public.faucets */
export type FaucetRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: FaucetStatus;
  location_name: string;
  lat: number;
  lng: number;
  daily_limit: number;
  claim_amount: number;
  cooldown_minutes: number;
  vault_address: string | null;
  created_at: string;
  updated_at: string;
};

/** Row in public.faucet_claims */
export type FaucetClaimRow = {
  id: string;
  faucet_id: string;
  user_id: string;
  wallet_address: string;
  amount: number;
  tx_hash: string | null;
  status: FaucetClaimStatus;
  claimed_at: string;
  ip_hash: string | null;
  user_agent_hash: string | null;
};

/** Public faucet shape (no vault address, no internal ids beyond slug). */
export type FaucetPublic = {
  slug: string;
  name: string;
  description: string | null;
  locationName: string;
  lat: number;
  lng: number;
  claimAmount: number;
  dailyLimit: number;
  status: FaucetStatus;
};

export type FaucetUnavailableReason =
  | "inactive"
  | "empty_today"
  | "insufficient_vault"
  | "global_cooldown"
  | "user_cooldown";

export type FaucetAvailability = {
  available: boolean;
  reason?: FaucetUnavailableReason;
  remainingToday: number;
  /** ISO timestamp when the faucet (or the user) can claim again. */
  nextAvailableAt?: string;
};

/** GET /api/faucets/[slug]/status */
export type FaucetStatusResponse = {
  faucet: FaucetPublic;
  availability: FaucetAvailability;
};

/** POST /api/faucets/[slug]/claim */
export type FaucetClaimResponse = {
  success: boolean;
  amount: number;
  /** Stored internally; only exposed for an optional technical-details drawer. */
  txHash?: string;
  nextAvailableAt?: string;
  error?: string;
  reason?: FaucetUnavailableReason | "wallet_missing" | "payment_failed" | "insufficient_vault";
};

/** Orb visual state used by the map and claim page. */
export type OrbState =
  | "available"
  | "cooldown"
  | "empty"
  | "inactive"
  | "claiming"
  | "success";

/** GET /api/faucets — map listing entry. */
export type FaucetMapEntry = FaucetPublic & {
  availability: FaucetAvailability;
  /** Vault address (C…) that accepts USDC deposits, when configured. */
  depositAddress: string | null;
};
