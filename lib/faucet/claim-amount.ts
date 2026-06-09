/** Per-claim amount in whole USDC: FAUCET_CLAIM_AMOUNT env override > faucet row. */
export function resolveClaimAmount(faucetAmount: number): number {
  const raw = process.env.FAUCET_CLAIM_AMOUNT?.trim();
  if (raw) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return faucetAmount;
}
