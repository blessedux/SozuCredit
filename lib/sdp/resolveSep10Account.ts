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
