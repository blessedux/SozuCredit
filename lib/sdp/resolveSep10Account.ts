/**
 * SEP-10 and SDP wallet registration expect a classic G… account the user can sign.
 * Soroban smart accounts (C…) use signer_public_key (factory) when present.
 */
export function resolveSep10StellarAccount(wallet: {
  publicKey: string;
  signerPublicKey?: string | null;
}): string | null {
  const pk = wallet.publicKey.trim();
  if (pk.startsWith("G") && pk.length === 56) return pk;

  if (pk.startsWith("C") && pk.length === 56) {
    const signer = wallet.signerPublicKey?.trim();
    if (signer?.startsWith("G") && signer.length === 56) return signer;
  }

  return null;
}
