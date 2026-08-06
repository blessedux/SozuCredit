/**
 * The ramp module's own provider surface (spec's modularity rule: a module
 * defines the interfaces it needs rather than importing them from a shared
 * schemas package). `etherfuse.ts`'s `createEtherfuseProvider` is the only
 * concrete implementation; keeping this file free of any Etherfuse detail is
 * what lets a future provider implement the same contract.
 *
 * Every shape below is evidence-backed against a real Etherfuse sandbox run —
 * see `docs/evidence/etherfuse-sandbox-findings.md`.
 */

/**
 * The customer's (organization's) KYC state. `approved` is the ONLY value
 * that unlocks bank-account/wallet registration and ramp orders — everything
 * else means "still verifying" to the service layer
 * (`docs/evidence/etherfuse-sandbox-findings.md` "## Org & KYC").
 */
export type RampKycStatus = 'not_started' | 'in_progress' | 'submitted' | 'approved' | 'denied';

/** A payin or payout quote — provider-agnostic amounts in integer cents. */
export interface RampQuote {
  quoteId: string;
  /** epoch ms — Etherfuse quotes expire 2 minutes after creation. */
  expiresAt: number;
  /** The quote's source-side amount (BRL on-ramp, token off-ramp). */
  senderAmountCents: number;
  /** The quote's destination-side amount, always rounded DOWN — never promise more than gets delivered. */
  receiverAmountCents: number;
  /** The provider's fee, denominated in the SOURCE asset, rounded UP — never understate a fee. */
  flatFeeCents: number;
  /** The quote's exchange rate (destination per source unit) as a number. */
  commercialQuotation: number;
}

/**
 * Etherfuse's order lifecycle. `created` → `funded` → `completed` was
 * observed live; the rest are the remaining documented states, treated as
 * terminal-failure or terminal-success by consumers
 * (`docs/evidence/etherfuse-sandbox-findings.md` "## Fiat received &
 * settlement"). Mirrors `RampOrderStatusSchema` (`@paltalabs/shared`).
 */
export type RampOrderStatus = 'created' | 'funded' | 'completed' | 'finalized' | 'failed' | 'refunded' | 'canceled';

/**
 * The BRL/PIX deposit instructions an on-ramp order returns. The sandbox
 * gives NO pix copy-paste code and no QR payload — it reuses the CLABE-shaped
 * response with `depositBankName: "PIX"` and an always-empty `depositClabe`
 * (dropped here). The user-facing instruction is therefore just the amount
 * plus the hosted status page
 * (`docs/evidence/etherfuse-sandbox-findings.md` "## Onramp order & deposit
 * payload" — revisit against production payloads before mainnet).
 */
export interface PixDeposit {
  /** Decimal string, in the fiat (BRL) currency. */
  depositAmount: string;
  depositBankName: string;
  depositAccountHolder: string;
}

/**
 * A just-created on-ramp order: the deposit instructions to show the
 * merchant. `POST /ramp/order`'s create response carries ONLY the deposit
 * block — no status, no settlement amount
 * (`docs/evidence/etherfuse-sandbox-findings.md` "## Onramp order & deposit
 * payload") — so this shape carries neither: status is implicitly `created`
 * (Etherfuse's own initial order state), and the settlement amount is
 * whatever the CALLER already quoted and is echoing back (the client-facing
 * contract is `PayinExecuteRequestSchema`, `@paltalabs/shared`) rather than
 * something this method could derive from the create response itself.
 */
export interface OnrampOrderState {
  orderId: string;
  deposit: PixDeposit;
}

/** An order's polled state, for both directions. */
export interface OrderState {
  orderId: string;
  status: RampOrderStatus;
  /**
   * `confirmedTxSignature` when Etherfuse reports one, else null — ALWAYS
   * nullable: completed on-ramp orders carry none at all in the sandbox, and
   * an off-ramp's value is Etherfuse's own internal transaction, NOT the
   * merchant's payment hash (`docs/evidence/etherfuse-sandbox-findings.md`
   * Conclusions §9).
   */
  txHash: string | null;
  /**
   * The order's `amountInTokens`, RAW (full provider precision, up to 27
   * fractional digits) — null whenever the field is absent, which is every
   * status except `completed` (`docs/evidence/etherfuse-sandbox-findings.md`
   * "## Fiat received & settlement": the in-flight `created` read carries no
   * token amount at all). A caller writing this into a Stellar-precision
   * column (the indexer ramp poller) is responsible for its own truncation —
   * this interface stays a faithful, unrounded echo of what the provider
   * reported, same policy as `txHash` above.
   */
  amountTokens: string | null;
}

/**
 * Anchor-mode off-ramp order details: where the merchant must send the
 * tokens, and the 32-byte hash memo that binds the payment to this order
 * (`docs/evidence/etherfuse-sandbox-findings.md` "## Anchor order"). The
 * caller builds/signs/submits that payment itself — this module never signs
 * or submits a Stellar transaction (same split as `VaultProvider`).
 */
export interface OfframpAnchorDetails {
  orderId: string;
  withdrawAnchorAccount: string;
  /** Base64 of exactly 32 bytes — build the payment with `Memo.hash(<decoded bytes>)`. */
  withdrawMemoBase64: string;
  withdrawMemoType: 'hash';
}

/**
 * Parameters for the hosted KYC (`/idv`) launch: the browser form-POSTs
 * `assertion` (a signed RS256 partner JWT) and `target` to `actionUrl`
 * (`docs/evidence/etherfuse-sandbox-findings.md` "## Launch JWT"). There is
 * no headless/API-only identity-verification path.
 */
export interface KycLaunch {
  actionUrl: string;
  assertion: string;
  target: string;
}

/** Thrown by any `RampProvider` method on a non-2xx provider response or malformed provider data. */
export class RampProviderError extends Error {
  constructor(
    /** short sanitized token, safe for client envelopes */
    public readonly reason: string,
    message: string
  ) {
    super(message);
    this.name = 'RampProviderError';
  }
}

/**
 * Onboards a merchant with the fiat on/off-ramp provider and quotes/executes
 * BRL-over-PIX on-ramp and off-ramp transfers. Mirrors `VaultProvider`'s
 * split (`api/src/modules/vault/provider.ts`): the provider only builds and
 * fetches data — the caller signs and submits.
 */
export interface RampProvider {
  /**
   * Creates the merchant's Etherfuse organization; the caller-generated
   * `customerId` UUID IS the organization id used by every other method
   * (re-posting the same id is idempotent). `email` must be a REAL,
   * receivable inbox — the hosted KYC flow emails a PIN to it even in
   * sandbox.
   */
  createOrganization(input: {customerId: string; displayName: string; email: string}): Promise<void>;
  getKycStatus(customerId: string): Promise<RampKycStatus>;
  /**
   * Synchronous — pure JWT signing, no HTTP. `userInfo` is required because
   * the partner JWT's `email` and `name` claims are mandatory (live-verified);
   * Etherfuse exposes no way to read a personal organization's email back, so
   * the caller must supply it on every launch.
   */
  buildKycLaunch(customerId: string, userInfo: {email: string; displayName: string}): KycLaunch;
  /** One BRL bank account per organization, and only after KYC is approved — both enforced by Etherfuse, surfaced as `bank_account_registration_failed`. */
  registerBankAccount(
    customerId: string,
    input: {transactionId: string; firstName: string; lastName: string; cpf: string; pixKey: string; pixKeyType: string}
  ): Promise<{bankAccountId: string}>;
  /** Idempotent per (customer, publicKey) — the same `walletId` comes back on a repeat call. */
  registerWallet(customerId: string, publicKey: string): Promise<{walletId: string}>;
  /** `amountFiat` is a decimal string (BRL); the returned quote expires in 2 minutes. */
  createOnrampQuote(input: {customerId: string; walletAddress: string; amountFiat: string}): Promise<RampQuote>;
  /** `amountToken` is a decimal string of the settlement asset; the returned quote expires in 2 minutes. */
  createOfframpQuote(input: {customerId: string; walletAddress: string; amountToken: string}): Promise<RampQuote>;
  /**
   * `orderId` is caller-generated (never client-supplied). A stale quote, or
   * a second open order for the same (bank account, amount), is rejected.
   * The returned `OnrampOrderState` carries no settlement amount — the
   * caller must already know it (from the quote it drove this order from).
   */
  createOnrampOrder(input: {
    orderId: string;
    quoteId: string;
    bankAccountId: string;
    cryptoWalletId: string;
  }): Promise<OnrampOrderState>;
  /** Anchor-mode off-ramp: returns the anchor account + hash memo for a payment the CALLER builds and submits. */
  createAnchorOfframpOrder(input: {
    orderId: string;
    quoteId: string;
    bankAccountId: string;
    cryptoWalletId: string;
  }): Promise<OfframpAnchorDetails>;
  /**
   * An order's current state. The returned `orderId` is echoed from the
   * provider; the order's own `customerId` is deliberately NOT exposed — it
   * is the PARTNER organization's id, not the merchant's, so it can never be
   * used for an ownership check (`docs/evidence/etherfuse-sandbox-findings.md`
   * Conclusions §10).
   */
  getOrder(orderId: string): Promise<OrderState>;
  /** Sandbox-only deposit simulator — the caller must gate this on the network being testnet. */
  simulateFiatReceived(orderId: string): Promise<void>;
}
