/**
 * SEP-10 and SDP wallet registration expect a classic G… account the user can sign.
 * Soroban smart accounts (C…) use signer_public_key (factory) when present.
 */
export function resolveSep10StellarAccount(wallet: {
  publicKey: string;
  signerPublicKey?: string | null;
}): string | null {
  // Passkey-derived G signer wins over legacy public_key (may be stale after sync-signer).
  const signer = wallet.signerPublicKey?.trim().toUpperCase();
  if (signer?.startsWith("G") && signer.length === 56) return signer;

  const pk = wallet.publicKey.trim().toUpperCase();
  if (pk.startsWith("G") && pk.length === 56) return pk;

  return null;
}

/**
 * SEP-24 deposit registration should target where funds are received.
 * Passkey smart wallets hold USDC on C…; SEP-10 still uses the G signer separately.
 */
export function resolveSep24DepositAccount(wallet: {
  publicKey: string;
  signerPublicKey?: string | null;
}): string | null {
  const pk = wallet.publicKey.trim().toUpperCase();
  if (pk.startsWith("C") && pk.length === 56) return pk;
  return resolveSep10StellarAccount(wallet);
}

/**
 * Stellar address on the SEP-24 JWT (must match SEP-10 subject for OTP/wallet linking).
 * Default: G signer. Override: SDP_SEP24_REGISTRATION_ACCOUNT=contract
 */
export function resolveSep24RegistrationAccount(params: {
  stellarAccount: string;
  depositAccount: string;
}): string {
  const mode = process.env.SDP_SEP24_REGISTRATION_ACCOUNT?.trim().toLowerCase();
  if (mode === "contract" || mode === "smart" || mode === "c") {
    return params.depositAccount;
  }
  return params.stellarAccount;
}
